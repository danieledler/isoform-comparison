import type { NetworkFile } from "../components/LoadNetworks";
import differenceIndex from "../utils/difference-index";
//@ts-ignore
import Tree from "../utils/Tree";
import AlluvialNodeBase from "./AlluvialNode";
import Branch from "./Branch";
import Depth, { NETWORK, ROOT } from "./Depth";
import HighlightGroup from "./HighlightGroup";
import Module from "./Module";
import Network from "./Network";
import StreamlineNode from "./StreamlineNode";

export type VerticalAlign = "bottom" | "justify" | "top";

export type ModuleSize = "flow" | "nodes";
export type ModuleOrder = ModuleSize | "highlightIndex" | "nodeId";

export interface LayoutOpts {
  height: number;
  streamlineFraction: number;
  moduleWidth: number;
  flowThreshold: number;
  verticalAlign: VerticalAlign;
  marginExponent: number;
  moduleSize: ModuleSize;
  sortModulesBy: ModuleOrder;
}

type NodeProps = {
  flow: number;
  numLeafNodes: number;
  highlightIndex?: number;
  largestNodeId?: number;
  meanNodeId?: number;
};
type GetNodeSize = (node: NodeProps) => number;

/*
                      Diagram
+--------------------------------------------------------------------------------------------------------------------------+
|                                                                                                                          |
|                     Network                                                                                              |
| +-------------------------------------------------+                                                                      |
| |                                                 |                                                                      |
| |                   Module                        |                                                                      |
| | +---------------------------------------------+ |                                                                      |
| | |                                             | |                                                                      |
| | |              HighlightGroup                 | |                                                                      |
| | | +-----------------------------------------+ | |                                                                      |
| | | |                                         | | |                                                                      |
| | | |    Branch (LEFT)       Branch (RIGHT)   | | |                                                                      |
| | | | +-----------------+ +-----------------+ | | |                                                                      |
| | | | |                 | |                 | | | |                                                                      |
| | | | | StreamlineNode  | | StreamlineNode  | | | |                                                                      |
| | | | | +-------------+ | | +-------------+ | | | |                                                                      |
| | | | | |             | | | |             | | | | |                                       StreamlineNode                 |
| | | | | |             | | | |             | | | | |                          +------------+-------------+                |
| | | | | |             | | | |             | | | | |                       +--+            |             |                |
| | | | | |             | | | +-------------+ | | | |                   +---+               |             |                |
| | | | | |             | | |                 | | | |              +----+                   |             |                |
| | | | | |             | | | StreamlineNode  | | | |          +---+                        |             |                |
| | | | | |             | | | +-------------+-----------------+                             |             |                |
| | | | | |             | | | |             |                                               |             |                |
| | | | | |             | | | |             |                  StreamlineLink               |             |                |
| | | | | |             | | | |             |                                               |             |                |
| | | | | |             | | | |             |                                               |             |                |
| | | | | |             | | | |             |  Source (LEFT)                 Target (RIGHT) |             |                |
| | | | | |             | | | |             |                                               |   LeafNode  |                |
| | | | | |             | | | |             |                                               | +-------------------------+  |
| | | | | |             | | | |             |                                               | |                         |  |
| | | | | |             | | | |             |                                               | |                         |  |
| | | | | |             | | | |             |                                               | +-------------------------+  |
| | | | | |             | | | |             |                                               |             |                |
| | | | | |   LeafNode  | | | |             |                                +--------------+-------------+                |
| | | | | | +-----------------------------+ |                           +----+                                             |
| | | | | | |                             | |                      +----+                                                  |
| | | | | | |                             | |                   +--+                                                       |
| | | | | | +-----------------------------+ |               +---+                                                          |
| | | | | |             | | | |             |           +--+                                                               |
| | | | | +-------------+ | | +-------------+----------+                                                                   |
| | | | |                 | |                 | | | |                                                                      |
| | | | +-----------------+ +-----------------+ | | |                                                                      |
| | | |                                         | | |                                                                      |
| | | +-----------------------------------------+ | |                                                                      |
| | |                                             | |                                                                      |
| | +---------------------------------------------+ |                                                                      |
| |                                                 |                                                                      |
| +-------------------------------------------------+                                                                      |
|                                                                                                                          |
+--------------------------------------------------------------------------------------------------------------------------+
 */
export default class Diagram extends AlluvialNodeBase<Network> {
  readonly depth = ROOT;
  flowThreshold: number = 0;

  constructor(networks: NetworkFile[] = []) {
    super(null, "", "root");

    for (let network of networks) {
      this.addNetwork(network);
    }
  }

  addNetwork(network: NetworkFile) {
    const { nodes, id } = network;

    if (this.children.some((network) => network.networkId === id)) {
      throw new Error(`Network with id ${id} already exists`);
    }

    Network.create(this, network).addNodes(nodes);
  }

  getNetwork(networkId: string): Network | null {
    return (
      this.children.find((network) => network.networkId === networkId) ?? null
    );
  }

  calcFlow() {
    console.time("Diagram.calcFlow");
    this.forEachDepthFirstPostOrderWhile(
      (node: any) => node.depth < Depth.LEAF_NODE,
      (node: any) => (node.flow = node.childFlow)
    );
    console.timeEnd("Diagram.calcFlow");
  }

  updateLayout({
    height,
    streamlineFraction,
    moduleWidth,
    flowThreshold,
    marginExponent,
    verticalAlign = "bottom",
    moduleSize = "flow",
    sortModulesBy = "flow",
  }: LayoutOpts) {
    console.time("Diagram.updateLayout");
    const numNetworks = this.children.length;

    if (!numNetworks) return;

    const streamlineWidth = streamlineFraction * moduleWidth;
    const networkWidth = moduleWidth + streamlineWidth;
    const totalWidth = networkWidth * numNetworks - streamlineWidth;

    this.width = totalWidth;
    this.height = height;
    this.flowThreshold = flowThreshold;

    let x = 0;
    let y = height;

    const maxNetworkFlow = Math.max(
      ...this.children.map((network) => network.flow)
    );

    const totalMargins = new Array(numNetworks).fill(0);
    const visibleFlows = new Array(numNetworks).fill(0);
    const visibleModules = new Array(numNetworks).fill(0);
    let networkIndex = 0;

    let getNodeSize: GetNodeSize | null = null;
    let moduleHeight = 0;
    let moduleMargin = 0;

    // Use first pass to get order of modules to sort streamlines in second pass
    // Y position of modules will be tuned in second pass depending on max margins
    this.forEachDepthFirstPreOrderWhile(
      (node: any) =>
        node.depth < Depth.MODULE ||
        (node instanceof Module && node.isVisible) ||
        node instanceof HighlightGroup,
      (node: any, i: number, nodes: any[]) => {
        if (node instanceof Network) {
          const getNodeSizeByProp = getNodeSizeByPropForNetwork(
            node,
            maxNetworkFlow
          );
          getNodeSize = getNodeSizeByProp(moduleSize);
          networkIndex = i;

          const visibleModules = node.children.filter(
            (module) => module.isVisible
          );
          const invisibleModules = node.children.filter(
            (module) => !module.isVisible
          );

          if (!node.isCustomSorted) {
            new Tree(
              visibleModules,
              getNodeOrderByPropForNetwork(node, maxNetworkFlow)(sortModulesBy)
            )
              .sort()
              .flatten()
              .forEach(
                (module: Module, index: number) => (module.index = index)
              );
            visibleModules.sort((a, b) => a.index - b.index);
          }

          node.children = [...visibleModules, ...invisibleModules];

          if (i > 0) x += networkWidth;
          y = height;
        } else if (node instanceof Module && getNodeSize) {
          node.children.sort((a: HighlightGroup, b: HighlightGroup) => {
            // Insignificant nodes always at the top
            if (a.insignificant !== b.insignificant)
              return Number(a.insignificant) - Number(b.insignificant);
            // FIXME highlight indices might not be sorted
            return a.highlightIndex - b.highlightIndex;
          });
          const margin =
            i + 1 < nodes.length
              ? 2 **
              (marginExponent -
                2 * differenceIndex(node.path, nodes[i + 1].path))
              : 0;
          const nodeSize = getNodeSize(node);
          moduleHeight = nodeSize * height;
          y -= moduleHeight;
          node.margin = margin;
          node.layout = { x, y, width: moduleWidth, height: moduleHeight };
          y -= moduleMargin = margin;
          totalMargins[networkIndex] += margin;
          visibleFlows[networkIndex] += nodeSize;
          visibleModules[networkIndex]++;
        } else if (node instanceof HighlightGroup && getNodeSize) {
          if (i === 0) {
            y += moduleHeight + moduleMargin;
          }
          const groupHeight = getNodeSize(node) * height;
          y -= groupHeight;
          node.layout = { x, y, width: moduleWidth, height: groupHeight };
          if (i + 1 === nodes.length) {
            y -= moduleMargin;
          }
        }
      }
    );

    const maxTotalMargin = Math.max(...totalMargins);
    let usableHeight = height - maxTotalMargin;

    const maxMarginFractionOfHeight = 0.2;
    const marginFractionOfHeight = maxTotalMargin / height;

    if (marginFractionOfHeight > maxMarginFractionOfHeight) {
      // Reduce margins to below 50% of vertical space
      // Use moduleMarginScale such that
      //   moduleMarginScale * maxTotalMargin / height == maxMarginFractionOfHeight
      const moduleMarginScale =
        (maxMarginFractionOfHeight * height) / maxTotalMargin;

      this.forEachDepthFirstWhile(
        (node: any) => node.depth <= Depth.MODULE,
        (node: any) => {
          if (node instanceof Module) {
            node.margin *= moduleMarginScale;
          }
        }
      );

      const scaledTotalMargin = maxTotalMargin * moduleMarginScale;
      usableHeight = height - scaledTotalMargin;
    }

    if (verticalAlign === "justify") {
      let totalMargin = maxTotalMargin;
      let visibleFlow = Math.max(...visibleFlows);
      let missingFlow = 0;
      let missingMargin = 0;
      let numMargins = 0;

      this.forEachDepthFirstWhile(
        (node: any) =>
          node.depth < Depth.MODULE ||
          (node instanceof Module && node.isVisible),
        (node: any, i: number) => {
          if (node instanceof Network) {
            totalMargin = totalMargins[i];
            numMargins = visibleModules[i] - 1;
            visibleFlow = visibleFlows[i];
            missingFlow = 1 - visibleFlow;
            missingMargin = missingFlow * usableHeight;
          } else if (node instanceof Module && node.margin > 0) {
            node.margin *= maxTotalMargin / totalMargin;
            if (numMargins > 0) {
              node.margin += missingMargin / numMargins;
            }
          }
        }
      );
    } // "justify"

    this.forEachDepthFirstWhile(
      (node: any) => node.depth <= Depth.BRANCH,
      (node: any) => {
        if (node instanceof Branch) {
          node.children.sort(
            (a, b) =>
              a.oppositeStreamlinePosition - b.oppositeStreamlinePosition
          );
        }
      }
    );

    x = 0;
    y = height;

    getNodeSize = null;

    this.forEachDepthFirstPostOrderWhile(
      (node: any) =>
        node.depth !== Depth.MODULE ||
        (node instanceof Module && node.isVisible),
      (node: any) => {
        if (node instanceof StreamlineNode) {
          if (!getNodeSize) {
            const network = node.getAncestor(NETWORK) as Network | null;
            if (!network) {
              console.error("Streamline node has no Network parent");
              return;
            }
            getNodeSize = getNodeSizeByPropForNetwork(
              network,
              maxNetworkFlow
            )(moduleSize);
          }
          const nodeHeight = getNodeSize(node) * usableHeight;
          y -= nodeHeight;
          node.layout = { x, y, width: moduleWidth, height: nodeHeight };
        } else if (node instanceof Branch && getNodeSize) {
          let branchHeight = getNodeSize(node) * usableHeight;
          node.layout = { x, y, width: moduleWidth, height: branchHeight };
          if (node.isLeft) {
            y += branchHeight;
          }
        } else if (node instanceof HighlightGroup && getNodeSize) {
          node.layout = {
            x,
            y,
            width: moduleWidth,
            height: getNodeSize(node) * usableHeight,
          };
        } else if (node instanceof Module && getNodeSize) {
          node.layout = {
            x,
            y,
            width: moduleWidth,
            height: getNodeSize(node) * usableHeight,
          };
          y -= node.margin;
        } else if (node instanceof Network) {
          node.layout = { x, y: 0, width: moduleWidth, height };
          x += networkWidth;
          y = height;
          getNodeSize = null;
        } else if (node instanceof Diagram) {
          node.layout = { x: 0, y: 0, width: totalWidth, height };
        }
      }
    );

    console.timeEnd("Diagram.updateLayout");
  }
}

function getNodeSizeByPropForNetwork(
  { numLeafNodes }: Network,
  maxFlow: number
) {
  return (property: ModuleSize): GetNodeSize => {
    if (property === "flow") {
      return (node) => node.flow / maxFlow;
    } else if (property === "nodes") {
      return (node) => node.numLeafNodes / numLeafNodes;
    }
    throw new Error("Module size must be either 'flow' or 'nodes'.");
  };
}

function getNodeOrderByPropForNetwork(
  { numLeafNodes }: Network,
  maxFlow: number
) {
  return (property: ModuleOrder): GetNodeSize => {
    if (property === "flow") {
      return (node) => node.flow / maxFlow;
    } else if (property === "nodes") {
      return (node) => node.numLeafNodes / numLeafNodes;
    } else if (property === "highlightIndex") {
      return (node) => -node.highlightIndex!;
    } else if (property === "nodeId") {
      return (node) => node.meanNodeId!;
    }
    throw new Error(
      "Module order must be either 'flow', 'nodes' or 'highlightIndex'."
    );
  };
}
