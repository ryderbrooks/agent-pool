

export class PopSet<T> extends Set<T> {
    pop():T {
        for (const i of this){
            this.delete(i);
            return i;
        }
        throw new Error('empty set');
    }
}