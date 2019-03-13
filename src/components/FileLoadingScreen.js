import React from "react";
import PropTypes from "prop-types";
import { Button, Icon, Segment, Table } from "semantic-ui-react";

import papaParsePromise from "../io/papa-parse-promise";
import { isValidExtension, getParser, acceptedFormats } from "../io/parsers";

function humanFileSize(bytes, si) {
  const thresh = si ? 1000 : 1024;
  if (Math.abs(bytes) < thresh) {
    return bytes + " B";
  }
  const units = si
    ? ["kB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"]
    : ["KiB", "MiB", "GiB", "TiB", "PiB", "EiB", "ZiB", "YiB"];
  let u = -1;
  do {
    bytes /= thresh;
    ++u;
  } while (Math.abs(bytes) >= thresh && u < units.length - 1);
  return bytes.toFixed(1) + " " + units[u];
}

const parsePromises = files => {
  const parseOpts = {
    comments: "#",
    delimiter: " ",
    quoteChar: '"',
    dynamicTyping: false,
    skipEmptyLines: true,
    worker: true
  };

  return files.map(file => papaParsePromise(file, parseOpts));
};

const fileExtension = filename => {
  const index = filename.lastIndexOf(".");
  if (index === -1 || index + 1 === filename.length) return "";
  return filename.substring(index + 1).toLowerCase();
};

export default class FileLoadingScreen extends React.Component {
  state = {
    files: [],
    loading: false
  };

  exampleNetworks = [
    "science1998_2y.ftree",
    "science2001_2y.ftree",
    "science2007_2y.ftree"
  ];

  static propTypes = {
    onSubmit: PropTypes.func
  };

  static defaultProps = {
    onSubmit: values => console.log(values)
  };

  loadSelectedFiles = () => {
    const validFiles = [];

    for (let file of this.input.files) {
      const extension = fileExtension(file.name);
      if (isValidExtension(extension)) {
        file.format = extension;
        validFiles.push(file);
      } else {
        console.error(`Invalid format for file ${file.name}`);
      }
    }

    this.input.value = "";

    Promise.all(parsePromises(validFiles)).then(parsed => {
      parsed
        .map(_ => _.errors)
        .forEach(_ =>
          _.forEach(err => {
            throw err;
          })
        );

      const newFiles = parsed.map((parsed, i) => ({
        parsed,
        name: validFiles[i].name,
        size: validFiles[i].size,
        format: validFiles[i].format
      }));

      this.setState(({ files }) => ({
        files: [...files, ...newFiles],
        loading: false
      }));
    });
  };

  removeFile = index =>
    this.setState(({ files }) => {
      files.splice(index, 1);
      return { files };
    });

  parseNetworks = () => {
    const { files } = this.state;

    const networks = files.map(file => {
      try {
        const parser = getParser(file.format);
        const parsed = parser(file.parsed.data);

        return {
          name: file.name,
          size: file.size,
          format: file.format,
          ...parsed
        };
      } catch (e) {
        throw new Error(`No parser found for format ${file.format}`);
      }
    });

    this.props.onSubmit(networks);
  };

  withLoadingState = callback => () =>
    this.setState({ loading: true }, () => setTimeout(callback, 50));

  loadExample = async () => {
    const networks = this.exampleNetworks;

    const validFiles = await Promise.all(
      networks.map(network => fetch(`/data/${network}`))
    ).then(responses => Promise.all(responses.map(res => res.text())));

    Promise.all(parsePromises(validFiles)).then(parsed => {
      parsed
        .map(_ => _.errors)
        .forEach(_ =>
          _.forEach(err => {
            throw err;
          })
        );

      const newFiles = parsed.map((parsed, i) => ({
        parsed,
        name: networks[i],
        size: new Blob([validFiles[i]]).size,
        format: fileExtension(networks[i])
      }));

      this.setState({
        files: newFiles,
        loading: false
      });
    });
  };

  render() {
    const { files, loading } = this.state;

    return (
      <Segment
        loading={loading}
        basic
        textAlign="center"
        style={{ marginLeft: "20vw", marginTop: "20vh", width: "60vw" }}
      >
        <Table celled definition singleLine>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell />
              {files.map((file, i) => (
                <Table.HeaderCell
                  collapsing
                  key={i}
                  textAlign="center"
                  selectable
                >
                  {i + 1}
                </Table.HeaderCell>
              ))}
              <Table.HeaderCell />
            </Table.Row>
          </Table.Header>

          <Table.Body>
            <Table.Row>
              <Table.Cell collapsing>Name</Table.Cell>
              {files.map((file, i) => (
                <Table.Cell collapsing key={i}>
                  {file.name}
                </Table.Cell>
              ))}
              <Table.Cell disabled />
            </Table.Row>
            <Table.Row>
              <Table.Cell collapsing>Size</Table.Cell>
              {files.map((file, i) => (
                <Table.Cell collapsing key={i}>
                  {humanFileSize(file.size, true)}
                </Table.Cell>
              ))}
              <Table.Cell disabled />
            </Table.Row>
            <Table.Row>
              <Table.Cell collapsing>Format</Table.Cell>
              {files.map((file, i) => (
                <Table.Cell collapsing key={i}>
                  {file.format}
                </Table.Cell>
              ))}
              <Table.Cell disabled />
            </Table.Row>
            <Table.Row>
              <Table.Cell collapsing>Remove</Table.Cell>
              {files.map((file, i) => (
                <Table.Cell collapsing key={i} selectable negative>
                  <a onClick={() => this.removeFile(i)}>Remove</a>
                </Table.Cell>
              ))}
              <Table.Cell disabled />
            </Table.Row>
          </Table.Body>

          <Table.Footer>
            <Table.Row>
              <Table.HeaderCell />
              <Table.HeaderCell colSpan={files.length + 1}>
                <Button
                  floated="right"
                  positive={this.state.files.length > 0}
                  disabled={this.state.files.length < 1}
                  size="small"
                  onClick={this.withLoadingState(this.loadExample)}
                >
                  Create diagram
                </Button>
                <label
                  className="ui small primary button icon right floated left labeled"
                  htmlFor="upload"
                >
                  <Icon name="plus" />
                  Add network
                </label>
                <Button
                  onClick={this.withLoadingState(this.parseNetworks)}
                  size="small"
                  floated="left"
                >
                  Load example
                </Button>
              </Table.HeaderCell>
            </Table.Row>
          </Table.Footer>
        </Table>

        <input
          style={{ display: "none" }}
          type="file"
          multiple
          id="upload"
          onChange={this.withLoadingState(this.loadSelectedFiles)}
          accept={acceptedFormats}
          ref={input => (this.input = input)}
        />
      </Segment>
    );
  }
}