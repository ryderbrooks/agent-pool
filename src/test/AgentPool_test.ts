import { assert } from 'chai';

import { createAgentPool }                    from '../index';
import { REJ, RES }                           from '../meta/types';
import { IAgentPool, IRequestable }           from '../meta/interfaces';
import { sRequestConstructorArgs, sTransfer } from '../meta/structs';


describe('AgentPool', () => {

    function agentConstructor(): Promise<IRequestable> {
        return new Promise<IRequestable>(( res: RES<IRequestable> ): void => {
            res({
                    request : ( args: sRequestConstructorArgs ): Promise<sTransfer> => {
                        return new Promise<sTransfer>(( res: RES<sTransfer>,
                                                        rej: REJ ): void => {
                            const path: string = args.headers[ ':path' ] as string;
                            const TO: number   = args.headers[ 'TO' ] as number;

                            setTimeout(() => {
                                switch ( path ) {
                                    case 'reject':
                                        rej(new Error('error'));
                                        break;
                                    case 'resolve':
                                        res({
                                                body            : Buffer.from('cool'),
                                                responseHeaders : undefined,
                                                stats           : {
                                                    bytes                   : 0,
                                                    response_micro_duration : 0,
                                                    transfer_micro_duration : 0,
                                                    status                  : 100,
                                                    utc_startTime           : new Date(),
                                                },

                                            });
                                        break;
                                    default:
                                        throw new Error('no path');
                                }
                            }, TO);
                        });
                    },
                });
        });
    }


    describe('single agent', () => {

        const aPool: IAgentPool<IRequestable> = createAgentPool(agentConstructor,
                                                                1);
        it('waits for agent', async () => {
            const pause: number           = 100;
            const maxAgents: number       = 1;
            const x: [ number, string ][] = [
                [ pause, 'resolve' ],
                [ pause, 'reject' ],
                [ pause, 'resolve' ],
            ];
            const t0: number              = Date.now();
            let tTotal: number            = - (maxAgents * pause);

            for ( const [ TO, path ] of
                x ) {
                tTotal += TO;
                try {
                    const agent: IRequestable = await aPool.getNextAgent();
                    aPool.request(agent, {
                        headers         : {
                            ':path' : path,
                            TO,
                        },
                        transferTimeout : 100,
                        responseTimeout : 200,
                        options         : {},
                    }).catch((r:any)=>r);

                } catch ( e ) {
                }
            }

            const z: number = Date.now() - t0;

            assert.isAbove(z, tTotal);
        });
    });


    describe('multiAgent', () => {
        it('waits for agent', async () => {
            const pause: number                   = 100;
            const maxAgents: number               = 2;
            const aPool: IAgentPool<IRequestable> = createAgentPool(agentConstructor,
                                                                    maxAgents);

            const x: [ number, string ][] = [
                [ pause, 'resolve' ],
                [ pause, 'resolve' ],
                [ pause, 'resolve' ],
                [ pause, 'resolve' ],
                [ pause, 'resolve' ],
                [ pause, 'resolve' ],
            ];
            const t0: number              = Date.now();
            let tTotal: number            = - (maxAgents * pause);

            for ( const [ TO, path ] of
                x ) {
                tTotal += TO;
                try {
                    const agent: IRequestable = await aPool.getNextAgent();

                    aPool.request(agent, {
                        headers         : {
                            ':path' : path,
                             TO,
                        },
                        transferTimeout : 100,
                        responseTimeout : 200,
                        options         : {},
                    });
                } catch ( e ) {
                }
            }

            const z: number = Date.now() - t0;

            assert.approximately(z, tTotal / 2, 30);

        });

    });
});