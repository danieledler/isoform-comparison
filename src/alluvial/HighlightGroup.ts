import AlluvialNodeBase from "./AlluvialNode";
import Branch from "./Branch";
import { HIGHLIGHT_GROUP } from "./Depth";
import type Module from "./Module";
import { LEFT, RIGHT } from "./Side";

export const NOT_HIGHLIGHTED = -1;

export default class HighlightGroup extends AlluvialNodeBase<Branch, Module> {
  children: Branch[] = [new Branch(this, LEFT), new Branch(this, RIGHT)];
  depth = HIGHLIGHT_GROUP;
  highlightIndex: number;
  insignificant: boolean;

  constructor(
    parent: Module,
    highlightIndex: number = NOT_HIGHLIGHTED,
    insignificant: boolean = false
  ) {
    super(
      parent,
      parent.networkId,
      `${parent.id}_group${insignificant ? "i" : ""}${highlightIndex}`
    );
    parent.addChild(this);
    this.highlightIndex = highlightIndex;
    this.insignificant = insignificant;
  }

  get isHighlighted(): boolean {
    return this.highlightIndex !== NOT_HIGHLIGHTED;
  }

  asObject() {
    return {
      ...this.layout,
      id: this.id,
      networkId: this.networkId,
      flow: this.flow,
      depth: this.depth,
      highlightIndex: this.highlightIndex,
      insignificant: this.insignificant,
    };
  }

  get left() {
    return this.children[0];
  }

  get right() {
    return this.children[1];
  }

  get isEmpty(): boolean {
    return this.left.isEmpty && this.right.isEmpty;
  }

  get numLeafNodes(): number {
    return this.left.numLeafNodes;
  }

  *leafNodes() {
    yield* this.left.leafNodes();
  }
}