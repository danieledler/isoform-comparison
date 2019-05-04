import React from "react";
import { Slider } from "react-semantic-ui-range";
import { Button, Checkbox, Icon, Input, Menu, Sidebar as SemanticSidebar } from "semantic-ui-react";
import FileSaver from "file-saver";

import AlluvialDiagram from "./AlluvialDiagram";
import readAsText from "../io/read-as-text";


export default class Sidebar extends React.Component {
  state = {
    width: 1200,
    height: 600,
    duration: 400,
    maxModuleWidth: 300,
    streamlineFraction: 2,
    streamlineOpacity: 0.5,
    moduleFlowThreshold: 8e-3,
    streamlineThreshold: 1,
    verticalAlign: "bottom",
    showModuleId: false,
    dropShadow: false,
  };

  input = null;

  validNumber = value => (Number.isNaN(+value) ? 0 : +value);

  saveSettings = () => {
    const settings = {
      networks: this.props.networks.map(network => network.name),
      ...this.state,
    };
    const json = JSON.stringify(settings, null, 2);
    const blob = new Blob([json], { type: 'text/plain;charset=utf-8' });
    FileSaver.saveAs(blob, "alluvial-settings.json");
  };

  parseSettings = async () => {
    if (!this.input) {
      throw new Error("Tried to parse settings but input was null");
    }

    const settings = await readAsText(this.input.files[0]);
    this.input.value = "";

    const state = JSON.parse(settings);

    this.setState(prevState => ({
      ...prevState,
      ...state,
    }));
  };

  render() {
    const { networks } = this.props;
    const {
      width,
      height,
      duration,
      maxModuleWidth,
      streamlineFraction,
      streamlineOpacity,
      moduleFlowThreshold,
      streamlineThreshold,
      verticalAlign,
      showModuleId,
      dropShadow,
    } = this.state;

    return (
      <SemanticSidebar.Pushable>
        <SemanticSidebar
          as={Menu}
          animation="overlay"
          width="wide"
          direction="right"
          visible={true}
          vertical
        >
          <Menu.Item>
            <Input
              type="text"
              label="Width"
              labelPosition="left"
              value={width}
              onChange={(e, { value }) => this.setState({ width: this.validNumber(value) })}
            />
          </Menu.Item>
          <Menu.Item>
            <Input
              type="text"
              label="Height"
              labelPosition="left"
              value={height}
              onChange={(e, { value }) => this.setState({ height: this.validNumber(value) })}
            />
          </Menu.Item>
          <Menu.Item>
            <Input
              type="text"
              label="Max module width"
              labelPosition="left"
              value={maxModuleWidth}
            />
            <Slider
              settings={{
                start: maxModuleWidth,
                min: 10,
                max: width,
                step: 10,
                onChange: maxModuleWidth => this.setState({ maxModuleWidth })
              }}
            />
          </Menu.Item>
          <Menu.Item>
            <Input
              type="text"
              label="Streamline fraction"
              labelPosition="left"
              value={streamlineFraction}
            />
            <Slider
              settings={{
                start: streamlineFraction,
                min: 0,
                max: 3,
                step: 0.1,
                onChange: streamlineFraction => this.setState({ streamlineFraction })
              }}
            />
          </Menu.Item>
          <Menu.Item>
            <Input
              type="text"
              label="Streamline opacity"
              labelPosition="left"
              value={streamlineOpacity}
            />
            <Slider
              settings={{
                start: streamlineOpacity,
                min: 0,
                max: 1,
                step: 0.05,
                onChange: streamlineOpacity => this.setState({ streamlineOpacity })
              }}
            />
          </Menu.Item>
          <Menu.Item>
            <Input
              type="text"
              label="Animation duration"
              labelPosition="left"
              value={duration}
            />
            <Slider
              discrete
              settings={{
                start: duration,
                min: 100,
                max: 2000,
                step: 100,
                onChange: duration => this.setState({ duration })
              }}
            />
          </Menu.Item>
          <Menu.Item>
            <Input
              type="text"
              label="Module flow threshold"
              labelPosition="left"
              value={moduleFlowThreshold}
            />
            <Slider
              discrete
              settings={{
                start: moduleFlowThreshold,
                min: 0,
                max: 0.05,
                step: 0.001,
                onChange: moduleFlowThreshold => this.setState({ moduleFlowThreshold })
              }}
            />
          </Menu.Item>
          <Menu.Item>
            <Input
              type="text"
              label="Streamline height threshold"
              labelPosition="left"
              value={streamlineThreshold}
            />
            <Slider
              discrete
              settings={{
                start: streamlineThreshold,
                min: 0,
                max: 2,
                step: 0.01,
                onChange: streamlineThreshold => this.setState({ streamlineThreshold })
              }}
            />
          </Menu.Item>
          <Menu.Item>
            <Button.Group>
              <Button icon active={verticalAlign === "bottom"}
                      onClick={() => this.setState({ verticalAlign: "bottom" })}>
                <Icon name='align left' rotated="clockwise"/>
              </Button>
              <Button icon active={verticalAlign === "justify"}
                      onClick={() => this.setState({ verticalAlign: "justify" })}>
                <Icon name='align justify' rotated="clockwise"/>
              </Button>
            </Button.Group>
          </Menu.Item>
          <Menu.Item>
            <Checkbox toggle onChange={(e, { checked }) => this.setState({ showModuleId: checked })}
                      checked={showModuleId} label="Show module id"/>
          </Menu.Item>
          <Menu.Item>
            <Checkbox toggle onChange={(e, { checked }) => this.setState({ dropShadow: checked })}
                      checked={dropShadow} label="Use drop shadow"/>
          </Menu.Item>
          <Menu.Item>
            <Button icon labelPosition="left" onClick={this.saveSettings}>
              <Icon name="download"/>Save
            </Button>
            <label className="ui icon left labeled button" htmlFor="upload">
              <Icon name="upload"/>Load
            </label>
            <input
              style={{ display: "none" }}
              type="file"
              id="upload"
              onChange={this.parseSettings}
              accept={".json"}
              ref={input => (this.input = input)}
            />
          </Menu.Item>
        </SemanticSidebar>
        <SemanticSidebar.Pusher style={{ overflow: "hidden", height: "100vh" }}>
          <React.StrictMode>
            <AlluvialDiagram
              networks={networks}
              width={width}
              height={height}
              maxModuleWidth={+maxModuleWidth}
              streamlineFraction={+streamlineFraction}
              streamlineOpacity={+streamlineOpacity}
              duration={+duration}
              moduleFlowThreshold={+moduleFlowThreshold}
              streamlineThreshold={+streamlineThreshold}
              verticalAlign={verticalAlign}
              showModuleId={showModuleId}
              dropShadow={dropShadow}
            />
          </React.StrictMode>
        </SemanticSidebar.Pusher>
      </SemanticSidebar.Pushable>
    );
  }
}
