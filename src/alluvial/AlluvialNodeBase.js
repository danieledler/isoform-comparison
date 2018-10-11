import Depth from './depth-constants';
// @flow
type Position = {
    x: number,
    y: number,
};

type Size = {
    width: number,
    height: number,
};

type Layout = Position & Size;

export type AlluvialNode = $Subtype<AlluvialNodeBase>; // eslint-disable-line no-use-before-define

export default class AlluvialNodeBase {
    flow: number = 0;
    networkIndex: number;
    id: string;

    x: number = 0;
    y: number = 0;
    height: number = 0;
    width: number = 0;

    +children: AlluvialNode[] = [];
    parent: ?AlluvialNode = null;

    constructor(networkIndex: number, parent: ?AlluvialNode = null, id: string = "") {
        this.networkIndex = networkIndex;
        this.parent = parent;
        this.id = id;
    }

    getAncestor(steps: number): ?AlluvialNodeBase {
        if (steps === 0) return this;
        if (!this.parent) return null;
        return this.parent.getAncestor(steps - 1);
    }

    get depth(): number {
        return 0;
    }

    get isEmpty(): boolean {
        return this.children.length === 0;
    }

    addChild(node: AlluvialNode) {
        this.children.push(node);
    }

    removeChild(node: AlluvialNode) {
        const index = this.children.indexOf(node);
        const found = index > -1;
        if (found) {
            this.children.splice(index, 1);
        }
        return found;
    }

    sortChildren() {
        // no-op
    }

    asObject(): Object {
        return {
            id: this.id,
            networkIndex: this.networkIndex,
            flow: this.flow,
            depth: this.depth,
            layout: this.layout,
            children: this.children.map(child => child.asObject()),
        };
    }

    * traverseDepthFirst(): Iterable<AlluvialNodeBase> {
        yield this;
        for (let child of this.children) {
            yield* child.traverseDepthFirst();
        }
    }

    * traverseDepthFirstWhile(predicate: (AlluvialNodeBase) => boolean): Iterable<AlluvialNodeBase> {
        if (!predicate(this)) return;
        yield this;
        for (let child of this.children) {
            yield* child.traverseDepthFirstWhile(predicate);
        }
    }

    /**
    Traverse leaf nodes.
    Note: If starting above the branching level, it only traverses leaf nodes
    of the left branch to not duplicate leaf nodes.
     */
    * traverseLeafNodes(): Iterable<AlluvialNodeBase> {
        if (this.depth === Depth.LEAF_NODE) {
            yield this;
        }
        // Only traverse into left branch to not duplicate leaf nodes
        const children = this.depth === Depth.HIGHLIGHT_GROUP ? [this.children[0]] : this.children;
        for (let child of children) {
            yield* child.traverseLeafNodes();
        }
    }

    set layout({ x, y, width, height }: Layout) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }

    get layout(): Layout {
        const { x, y, width, height } = this;
        return { x, y, width, height };
    }

    get byFlow() {
        return -this.flow;
    }
}
