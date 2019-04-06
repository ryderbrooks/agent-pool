import { IAsyncPool }             from '../meta/interfaces';
import { RES, tAgentConstructor } from '../meta/types';
import { IPopSet, PopSet }        from 'pop-set';



export class AsyncPool<T> implements IAsyncPool<T>{
    private idle: IPopSet<T>   = new PopSet();
    private agents: Set<T> = new Set();
    private agentConstructor: any;
    private maxAgents: number;
    private pendingRes: Function | undefined;


    constructor( agentConstructor: tAgentConstructor<T>, maxAgents: number ) {
        this.maxAgents        = maxAgents;
        this.agentConstructor = agentConstructor;
    }

    get agentCnt(): number {
        return this.agents.size;
    }

    get idleCnt():number{
        return this.idle.size;
    }

    async getNext(): Promise<T> {
        switch ( true ) {
            case this.agentCnt < this.maxAgents:
                // we are below the maxAgent limit
                // create a new agent and fall threw
                await this.createAgent();
            case this.idle.size > 0:
                // we have an idle agent that can be used
                return this.idle.pop();
            case this.pendingRes !== undefined:
                // we have max agents
                // we have no idle agents that can be used
                // and we already have a pending response
                // this happens because a promise was not respected
                throw new Error('can only have 1 pending res');

            default:
                return new Promise(( res: RES<T> ): void => {

                    this.pendingRes = (): void => {
                        res(this.getNext()
                                .then(( agent: T ) => {
                                    this.pendingRes = undefined;
                                    return agent;
                                }));
                    };

                });
        }
    }


    release():void {
        if (typeof this.pendingRes === 'function'){
            this.pendingRes();
        }
    }
    remove( agent: T ): void {
        this.idle.delete(agent);
        if( this.agents.has(agent) ) {
            this.agents.delete(agent);
        }
        this.release();
    }


    add( agent: T ): void {
        if (!agent){
            throw new TypeError('bad agent');
        }
        this.idle.add(agent);
        this.release();
    }


    private async createAgent(): Promise<T>{
        const agent: T = await this.agentConstructor();
        if(!agent){
            throw new Error('agent creation failed');
        }

        this.agents.add(agent);
        this.add(agent);
        return agent;
    }
}

