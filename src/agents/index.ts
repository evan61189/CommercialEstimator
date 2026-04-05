import { AgentRole } from '@/lib/types';
import { BaseAgent } from './base-agent';
import { directorAgent } from './director';
import { seniorEstimatorAgent } from './senior-estimator';
import { juniorEstimatorAgent } from './junior-estimator';
import { procurementAgent } from './procurement';
import { administratorAgent } from './administrator';

export const agents: Record<AgentRole, BaseAgent> = {
  director: directorAgent,
  'senior-estimator': seniorEstimatorAgent,
  'junior-estimator': juniorEstimatorAgent,
  procurement: procurementAgent,
  administrator: administratorAgent,
};

export { BaseAgent } from './base-agent';
export { directorAgent } from './director';
export { seniorEstimatorAgent } from './senior-estimator';
export { juniorEstimatorAgent } from './junior-estimator';
export { procurementAgent } from './procurement';
export { administratorAgent } from './administrator';
