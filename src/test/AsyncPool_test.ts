import { assert }     from 'chai';
import { AsyncPool }  from '../lib/AsyncPool';
import { IAsyncPool } from '../meta/interfaces';
import { RES,REJ }        from '../meta/types';


interface IResRejFlag {
    resolve?: any;
    reject?: any;
}



interface IFakeAgent {
    doSomethingAsync: ( timeout: number,
                        pool:IAsyncPool<IFakeAgent>,
                        agent:IFakeAgent,
                        { resolve, reject }: IResRejFlag ) => Promise<any>;
}

interface ILooperReturn {
    results: Promise<any>[];
    checkArray: number[];
    timeToReachMaxAgents: number|undefined;
    usedTimeouts: number[];
    poolWaits: number[];
    idleAgentsLog: number[];
    totalAgentsLog: number[];
    averageWaitTimeBeforeMaxAgents :number;
    waitTimesAfterMaxAgents: number[];
    waitTimesBeforeMaxAgents: number[];
}

interface IAgentPayload {
    message: any;
    agentID: number;
}

describe('AsyncPool', () => {


    let agentID: number = 0;
    function agentConstructor(): IFakeAgent {
        agentID += 1;
        const ID: number = agentID;

        return {
            doSomethingAsync : ( timeout: number,
                                 pool:IAsyncPool<IFakeAgent>,
                                 agent:IFakeAgent,
                                 { resolve, reject }: IResRejFlag ): Promise<any> => {
                return new Promise(( res: RES<any>, rej: REJ ): void => {
                    switch ( true ) {
                        case resolve !== undefined:
                            setTimeout(() => {
                                pool.add(agent);
                                const payload:IAgentPayload = {message: resolve, agentID: ID};
                                res(payload);
                            }, timeout);
                            return;
                        case reject !== undefined:
                            setTimeout(() => {
                                pool.remove(agent);
                                const payload:IAgentPayload = {message: reject, agentID: ID};
                                rej(payload);
                            }, timeout);
                            return;
                        default:
                            throw new Error('missed ');
                    }
                });

            },
        };
    }



    async function looper( maxAgents: number,
                           loops:number,
                           timeoutsArray: number[]= [ 200, 150, 200, 300, 400, 500 ],
                           defaultTimeout: number = 100,
                           promiseAction: IResRejFlag[] = []
    ):Promise<ILooperReturn> {


        // if a timeout value is smaller than the amount of time it takes to
        // loop to the maxAgent size the agent will be returned to the pool
        // before we can validate the queueing mechanism


        // @ts-ignore
        const asyncPool: IAsyncPool<IFakeAgent> = new AsyncPool<IFakeAgent>(agentConstructor,
                                                                            maxAgents);


        let cnt: number = 0;

        const T0:[number, number] = process.hrtime();



        let T1:[number, number] = process.hrtime();

        let minTO: number | undefined;


        let timeToReachMaxAgents: number | undefined;


        const results: Promise<any>[] = [];
        const checkArray: number[]    = [];
        const poolWaits: number[]     = [];
        const loopTimes: number[]     = [];
        const usedTimeouts: number[]   = [];



        const idleAgentsLog: number[] = [asyncPool.idleCnt];
        const totalAgentsLog: number[] = [asyncPool.agentCnt];

        while ( cnt < loops ) {
            cnt += 1;
            checkArray.push(cnt);

            if( cnt === maxAgents + 1 ) {
                timeToReachMaxAgents = hrtToMS(process.hrtime(T0));
            }

            // log how long we wait for this call
            const tBefore             = process.hrtime();
            const agent: IFakeAgent = await asyncPool.getNext();
            poolWaits.push(hrtToMS(process.hrtime(tBefore)));

            idleAgentsLog.push(asyncPool.idleCnt);
            totalAgentsLog.push(asyncPool.agentCnt);


            const to: number | undefined = timeoutsArray[ cnt - 1 ]
                                           ? timeoutsArray[ cnt - 1 ]
                                           : defaultTimeout;

            usedTimeouts.push(to);

            if( ! minTO || to < minTO ) {
                minTO = to;
            }




            const pAction: IResRejFlag = promiseAction[cnt-1]? promiseAction[cnt-1] :{resolve:cnt};

            results.push(agent.doSomethingAsync(to,
                                                asyncPool,
                                                agent,
                                                pAction));


            T1 = process.hrtime(T1);
            loopTimes.push(hrtToMS(T1));
        }

        const r:ILooperReturn = {
            results,
            checkArray,
            timeToReachMaxAgents,
            usedTimeouts,
            poolWaits,
            idleAgentsLog,
            totalAgentsLog,
            averageWaitTimeBeforeMaxAgents : poolWaits
                                                 .slice(0, maxAgents)
                                                 .reduce(( prev: number, cur: number ): number => cur + prev, 0)
                                             / maxAgents,
            waitTimesAfterMaxAgents: poolWaits.slice(maxAgents),
            waitTimesBeforeMaxAgents: poolWaits.slice(0, maxAgents),
        };
        return r;


    }


    function hrtToMS( hrtTime: [ number, number ] ): number {
        const x: number = (hrtTime[ 0 ] * 1e9) + hrtTime[ 1 ];
        return x / 1e6;
    }


    beforeEach(()=>{
        agentID = 0;
    });


    it('fills the agent pool', async () => {
        const maxAgents:number = 5;
        const loops:number = maxAgents + 4;
        const stats:ILooperReturn =await looper(maxAgents, loops);
        const maxTotalAgents:number = Math.max(...stats.totalAgentsLog);
        assert.isAbove(maxTotalAgents, 0);
        assert.isBelow(maxTotalAgents, loops);
    });

    it('does not exceed max agents', async () => {
        const maxAgents:number = 5;
        const loops:number = maxAgents + 4;
        const stats:ILooperReturn =await looper(maxAgents, loops);
        const maxTotalAgents:number = Math.max(...stats.totalAgentsLog);
        assert.equal(maxTotalAgents, maxAgents);
    });

    it('executes correct number of times', async ()=>{
        const maxAgents:number = 5;
        const loops:number = maxAgents + 4;
        const stats:ILooperReturn =await looper(maxAgents, loops);
        assert.equal(stats.results.length, loops);
    });

    it('resolves in order', async ()=>{
        const maxAgents:number = 5;
        const loops:number = maxAgents + 4;
        const stats:ILooperReturn =await looper(maxAgents, loops);
        const resolved: IAgentPayload[] = await Promise.all(stats.results);

        assert.deepEqual(resolved.map((d:IAgentPayload)=>d.message),
                         stats.checkArray);
    });

    it('does not delay before maxAgents is reached', async()=>{
        const maxAgents:number = 3;
        const loops:number = maxAgents + 1;
        const stats:ILooperReturn =await looper(maxAgents, loops);

        const maxBeforeMax: number = Math.max(...stats.waitTimesBeforeMaxAgents);
        const minTimeoutUsed: number = Math.min(...stats.usedTimeouts);
        assert.isBelow(maxBeforeMax, minTimeoutUsed);
    });

    it('delays until the first promise resolution', async ()=>{
        const maxAgents:number = 5;
        const loops:number = maxAgents + 4;
        const maxWait: number = 300;
        const timeoutsArray: number[] = [maxWait, maxWait, 100, maxWait];
        const stats:ILooperReturn =await looper(maxAgents,
                                                loops,
                                                timeoutsArray,
                                                maxWait);

        const firstWaitTime: number = stats.poolWaits[maxAgents];
        const minTimeout: number = Math.min(...stats.usedTimeouts);

        assert.isAbove(firstWaitTime, minTimeout);
        assert.isBelow(firstWaitTime, maxWait);
    });

    it.skip('removes agent', async ()=>{
        const maxAgents:number = 5;
        const loops:number = maxAgents + 10;
        const timeouts:number[] = [1];
        const action:any = [{reject: 'ok'}];

        await looper(maxAgents,
                                                loops,
                                                timeouts,
                                                undefined,
                                                action);
        assert.isTrue(false);
    });


});