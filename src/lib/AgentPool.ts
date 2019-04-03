import { EventEmitter }                       from 'events';
import { sRequestConstructorArgs, sTransfer } from '../meta/structs';

import { AsyncPool }                            from './AsyncPool';
import { IAgentPool, IAsyncPool, IRequestable } from '../meta/interfaces';
import { tAgentConstructor }                    from '../meta/types';



export class AgentPool extends EventEmitter implements IAgentPool<IRequestable> {
    public getNextAgent(): Promise<IRequestable> {
        return this.pool.getNext();
    }


    remove( agent: IRequestable ): void {
        this.pool.remove(agent);
    }


    public async request( args: sRequestConstructorArgs ): Promise<sTransfer> {
        let agent: IRequestable | undefined;
        try {
            agent = await this.pool.getNext();
        } catch ( e ) {
            throw e;
        }

        return agent.request(args)
                    .then(( response: sTransfer ) => {
                        this.pool.add(agent!);
                        return response;
                    })
                    .catch(( err: Error ) => {
                        switch ( err.message ) {
                            default:
                                this.pool.remove(agent!);
                        }
                        throw err;
                    });
    }


    constructor( agentConstructor:tAgentConstructor<IRequestable>, maxAgents: number ) {
        super();
        this.pool = new AsyncPool<IRequestable>(agentConstructor,
                                                maxAgents);
    }


    private pool: IAsyncPool<IRequestable>;
}


