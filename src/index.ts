import { IAgentPool, IRequestable } from './meta/interfaces';
import { tAgentConstructor }        from './meta/types';
import { AgentPool }                from './lib/AgentPool';

export {IAgentPool} from './meta/interfaces';
export function createAgentPool( agentConstructor: tAgentConstructor<IRequestable>,
                                 maxAgents: number):IAgentPool<IRequestable> {
    return new AgentPool(agentConstructor, maxAgents);
}
