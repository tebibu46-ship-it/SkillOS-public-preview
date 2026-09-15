import type { PersonalLearningModel, NextBestAction } from './learner';
import type { AdaptiveLearningPath } from './adaptive-path';
import type { ExperimentOutcomeSnapshot, ExperimentSelection } from './experiments';
import type { DurableAssessment } from './assessment';
import type { EvidenceVerificationSnapshot } from './verification';

/** Presentation only; all decisions and source references originate in the model. */
export function renderLearningIntelligence(host: HTMLElement, model: PersonalLearningModel & { adaptivePath?: AdaptiveLearningPath; experimentSelection?: ExperimentSelection; evidenceVerification?: EvidenceVerificationSnapshot | null; experimentOutcome?: ExperimentOutcomeSnapshot | null; assessmentContext?: { current: DurableAssessment | null; history: DurableAssessment[] } }, act: (next: NextBestAction) => Promise<void>) {
  host.classList.add('learning-intelligence');
  const node = (tag: string, text: string) => { const el = document.createElement(tag); el.textContent = text; return el; };
  const next = model.nextAction;
  const labels = { continue_session: 'Continue your session', resolve_prerequisite: 'Start prerequisite session', start_session: 'Start learning session', complete_action: 'Open unfinished action', create_demonstration: 'Create demonstration', add_evidence: 'Add proof to completed work', clarify_goal: 'Choose a learning goal', inspect_context: 'Review learning context' };
  host.replaceChildren(node('h3', 'What now?'), node('p', labels[next.type]));
  host.append(node('p', `Learning state: ${model.activeGoals.length} active goals · Evidence level: ${next.evidenceLevel}. This describes recorded evidence, not mastery.`));
  if (model.nextBestSkill) host.append(node('p', `Next best skill: ${model.snapshot.skills?.find(s => s.id === model.nextBestSkill?.skillId)?.name || 'Unavailable'}`));
  const nextCapability = model.nextBestSkill ? model.capabilities?.skills.find(item => item.skillId === model.nextBestSkill?.skillId) : null;
  if (nextCapability) {
    host.append(node('p', `Capability state: ${nextCapability.state}. ${nextCapability.explanation}`));
    if (nextCapability.conflicts.length) host.append(node('p', `Conflict: ${nextCapability.conflicts[0].explanation}`));
  }
  const projectProofs = model.projectProofs || [];
  const projectProofSkills = new Set<string>();
  for (const proof of projectProofs) {
    const skillName = model.snapshot.skills?.find(skill => skill.id === proof.skillId)?.name || proof.skillId;
    if (projectProofSkills.has(`${proof.skillId}:${proof.status}`)) continue;
    projectProofSkills.add(`${proof.skillId}:${proof.status}`);
    host.append(node('p', proof.status === 'SUPPORTED' ? `${skillName} is supported by project evidence.` : `${skillName} is referenced by a project, but supporting evidence is incomplete.`));
  }
  if (model.adaptivePath?.currentStep) host.append(node('p', `Learning path · Step ${model.adaptivePath.currentStep.position} of ${model.adaptivePath.orderedSteps.length}: ${model.adaptivePath.currentStep.skillName}`), node('p', model.adaptivePath.explanation));
  const selectedExperiment = model.experimentSelection?.experiment;
  if (selectedExperiment) {
    host.append(node('h4', 'Learning experiment'), node('p', `${selectedExperiment.title} · ${selectedExperiment.skillId}`), node('p', selectedExperiment.objective));
    host.append(node('p', `Success: ${selectedExperiment.successConditions.join(' ')}`), node('p', `Evidence: ${selectedExperiment.evidenceRequirements.filter(item => item.required).map(item => item.description).join(' ')}`));
    if (selectedExperiment.steps.length) host.append(node('p', `Steps: ${selectedExperiment.steps.map(step => `${step.order}. ${step.title}: ${step.instruction}`).join(' ')}`));
    if (selectedExperiment.acceptanceCriteria.length) host.append(node('p', `Acceptance criteria: ${selectedExperiment.acceptanceCriteria.map(criteria => `${criteria.order}. ${criteria.statement}`).join(' ')}`));
    if (selectedExperiment.constraints.length) host.append(node('p', `Constraints: ${selectedExperiment.constraints.map(constraint => `${constraint.order}. ${constraint.statement}`).join(' ')}`));
    host.append(node('p', `Why this experiment? ${model.experimentSelection?.reason || 'It is selected from the current eligible path step.'}`));
    const verification = model.evidenceVerification;
    if (verification) {
      host.append(node('h4', 'Evidence verification'), node('p', `State: ${verification.state.replaceAll('_', ' ').toLowerCase()}.`));
      const requirements = node('ul', '');
      for (const requirement of verification.requirements.filter(item => item.required)) {
        const marker = requirement.state === 'SUFFICIENT' ? '✓' : requirement.state === 'MISSING' ? '○' : '·';
        requirements.append(node('li', `${marker} ${requirement.explanation}`));
      }
      host.append(requirements);
    }
    const outcome = model.experimentOutcome;
    if (outcome) {
      host.append(node('h4', 'Attempt history'), node('p', outcome.current ? `${outcome.reason} ${outcome.history.length > 1 ? `${outcome.history.length - 1} previous attempts.` : ''}` : outcome.reason));
      if (outcome.nextUnmetRequirement) host.append(node('p', `Next requirement: ${outcome.nextUnmetRequirement.replace(':', ' · ')}.`));
      if (outcome.conflicts.length) host.append(node('p', `Historical outcomes include ${outcome.conflicts[0].results.join(' and ')}; each attempt remains preserved.`));
    }
    const assessmentContext = model.assessmentContext;
    if (assessmentContext?.current) {
      host.append(node('h4', 'Assessment'), node('p', `Assessment ${assessmentContext.current.status.toLowerCase().replaceAll('_', ' ')} · Evaluator: ${assessmentContext.current.evaluator}.`));
      if (assessmentContext.current.feedback) host.append(node('p', `Feedback: ${assessmentContext.current.feedback}`));
      if (assessmentContext.history.length > 1) host.append(node('p', `Previous assessments: ${assessmentContext.history.length - 1}.`));
    }
  } else if (model.experimentSelection?.status === 'NO_TEMPLATE_AVAILABLE') {
    host.append(node('p', model.experimentSelection.reason));
  }
  if (next.status === 'insufficient_evidence') host.append(node('p', 'Insufficient evidence for a new learning recommendation.'));
  host.append(node('h4', 'Why this step?'));
  const reasons = node('ul', '');
  for (const reason of next.reasons) {
    const item = node('li', reason.explanation), details = node('details', '');
    details.append(node('summary', 'Source records'), node('p', reason.sources.length ? reason.sources.map(s => `${s.table}: ${s.id}`).join(' · ') : 'Based on the absence of records in the loaded context.'));
    item.append(details); reasons.append(item);
  }
  host.append(reasons);
  if (model.blockers.length) {
    host.append(node('h4', 'What is blocking me?'));
    host.append(node('p', `Primary blocker: ${model.blockers[0].explanation}`));
    const list = node('ul', '');
    for (const b of model.blockers) list.append(node('li', `${b.explanation} ${b.resolution || ''}`));
    host.append(list);
  }
  const button = document.createElement('button'); button.type = 'button'; button.className = 'primary'; button.textContent = labels[next.type];
  button.onclick = async () => { button.disabled = true; try { await act(next); } finally { button.disabled = false; } };
  host.append(button);
}
