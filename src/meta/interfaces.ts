import { sRequestConstructorArgs, sTransfer } from './structs';


export interface IAsyncPool<T> {
}


export interface IRequestable {
    alpnProtocol?: string | undefined;

    request( { headers, options, responseTimeout, transferTimeout }: sRequestConstructorArgs ): Promise<sTransfer>;
}

export interface IAgentPool<T> {
    request(agent:IRequestable, args: sRequestConstructorArgs):Promise<sTransfer>;
    getNextAgent():Promise<T>;
    remove(agent:T):void;
}

export interface IAsyncPool<T> {
    getNext():Promise<T>;
    add(agent:T):void;
    remove(agent:T):void;
    release():void;
    agentCnt:number;
    idleCnt: number;
}


