// @flow
import type { Module, Node } from "../io/parse-ftree";
import id from "../lib/id";
import TreePath from "../lib/treepath";
import AlluvialNode from "./AlluvialNode";
import Path from "./Path";


type Predicate<T> = T => boolean;

export default class AlluvialModule extends Path {
    id: string = id();
    modules: AlluvialModule[];
    nodes: AlluvialNode[];
    left: ?AlluvialModule = null;
    right: ?AlluvialModule = null;
    parent: ?AlluvialModule;
    flow: number = 0;

    constructor(module: Module,
                subModules: Module[],
                nodes: Node[],
                parent: ?AlluvialModule = null) {
        super(module.path);
        this.flow = module.flow;
        this.parent = parent;

        this.modules = subModules.filter(module => this.path.isParentOf(module.path))
            .map(subModule => {
                const modulePath = new TreePath(subModule.path);
                return new AlluvialModule(
                    subModule,
                    subModules.filter(m => modulePath.isAncestor(m.path)),
                    nodes.filter(n => modulePath.isAncestor(n.path)),
                    this);
            });

        let accumulatedFlow = 0;
        const accumulationTarget = 0.95 * this.flow;

        this.nodes = nodes.sort((a, b) => b.flow - a.flow)
            .filter(node => (accumulatedFlow += node.flow) <= accumulationTarget)
            .map(node => new AlluvialNode(node, this))
            .sort((a, b) => a.rank - b.rank);
    }

    setRight(right: AlluvialModule): void {
        this.right = right;
        this.modules.forEach(m => m.setRight(right));
    }

    setLeft(left: AlluvialModule): void {
        this.left = left;
        this.modules.forEach(m => m.setLeft(left));
    }
}