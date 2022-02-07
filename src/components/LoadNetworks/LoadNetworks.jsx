import {
  ChevronDownIcon,
  QuestionOutlineIcon,
  RepeatIcon,
} from "@chakra-ui/icons";
import {
  Box,
  Button,
  FormLabel,
  HStack,
  Menu,
  MenuButton,
  MenuDivider,
  MenuItem,
  MenuList,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Radio,
  RadioGroup,
  Skeleton,
  Tooltip,
  useColorModeValue,
  useToast,
} from "@chakra-ui/react";
import {
  extension as fileExtension,
  parse,
  readFile,
} from "@mapequation/infomap/parser";
import { AnimatePresence, Reorder } from "framer-motion";
import JSZip from "jszip";
import localforage from "localforage";
import { observer } from "mobx-react";
import { useCallback, useContext, useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import { MdOutlineDelete, MdUpload } from "react-icons/md";
import useEventListener from "../../hooks/useEventListener";
import { StoreContext } from "../../store";
import id from "../../utils/id";
import TreePath from "../../utils/TreePath";
import Item from "./Item";
import "./LoadNetworks.css";
import Stepper from "./Stepper";

localforage.config({ name: "infomap" });

const acceptedFormats = [
  ".tree",
  ".ftree",
  ".stree",
  ".clu",
  ".json",
  ".net",
  ".zip",
].join(",");

const exampleDataFilename = "science-1998-2001-2007.json";

async function fetchExampleData(filename = exampleDataFilename) {
  const res = await fetch(`/alluvial/data/${filename}`);
  return await res.json();
}

function createError(file, code, message) {
  return {
    file,
    errors: [{ code, message }],
  };
}

export default observer(function LoadNetworks({ onClose }) {
  const store = useContext(StoreContext);
  const toast = useToast();
  const dropzoneBg = useColorModeValue(
    "var(--chakra-colors-gray-50)",
    "var(--chakra-colors-gray-600)"
  );
  const [isCreatingDiagram, setIsCreatingDiagram] = useState(false);
  const [isLoadingExample, setIsLoadingExample] = useState(false);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [infomapRunning, setInfomapRunning] = useState(false);
  const [files, setFiles] = useState(store.files);
  const [localStorageFiles, setLocalStorageFiles] = useState([]);
  const reset = useCallback(() => setFiles([]), []);

  const onError = useCallback(
    ({ title, description, ...props }) => {
      console.warn(description);
      toast({
        title,
        description,
        status: "error",
        duration: 5000,
        isClosable: true,
        ...props,
      });
    },
    [toast]
  );

  const onDrop = async (acceptedFiles) => {
    console.time("onDrop");
    setIsLoadingFiles(true);

    const readFiles = [];
    const errors = [];

    const accepted = acceptedFormats
      .split(",")
      .map((ext) => ext.slice(1))
      .filter((ext) => ext !== "zip");

    // Unzip compressed files, read uncompressed files
    let fileIndex = 0;
    for (const file of [...acceptedFiles]) {
      if (file?.type === "application/zip") {
        try {
          // Remove the zipped file from the list of files
          acceptedFiles.splice(fileIndex, 1);

          const zipFile = await JSZip.loadAsync(file);

          for (const [name, compressedFile] of Object.entries(zipFile.files)) {
            const extension = fileExtension(name);

            if (!accepted.includes(extension)) {
              errors.push(
                createError(
                  { name },
                  "unsupported-format",
                  `Unsupported file format: ${extension}`
                )
              );
              continue;
            }

            const uncompressedFile = await compressedFile.async("string");
            readFiles.push(uncompressedFile);

            // Add the decompressed file to the list of files
            acceptedFiles.splice(fileIndex, 0, {
              name,
              // Hack to get the decompressed size. Uses private fields of the JSZip object
              size: compressedFile?._data?.uncompressedSize ?? file.size,
              lastModified: file.lastModified,
            });
            fileIndex++;
          }
        } catch (e) {
          errors.push(createError(file, "unsupported-format", e.message));
        }
      } else {
        readFiles.push(await readFile(file));
        fileIndex++;
      }
    }

    const newFiles = [];

    // Parse files
    for (let i = 0; i < acceptedFiles.length; ++i) {
      const file = acceptedFiles[i];
      const format = fileExtension(file.name);

      let contents = null;

      if (format === "json") {
        try {
          contents = JSON.parse(readFiles[i]);

          if (contents.networks !== undefined) {
            // A diagram contains several networks.
            // Create a new file for each network.
            const diagramFiles = createFilesFromDiagramObject(contents, file);

            // If any file ids already exist, give a new id
            for (let existingFile of [...files, ...newFiles]) {
              for (let diagramFile of diagramFiles) {
                if (existingFile.id === diagramFile.id) {
                  diagramFile.id = id();
                }
              }
            }

            newFiles.push(...diagramFiles);
            continue;
          }
        } catch (e) {
          errors.push(createError(file, "invalid-json", e.message));
          continue;
        }
      } else if (format === "net") {
        contents = {
          network: readFiles[i],
          noModularResult: true,
        };
      } else {
        try {
          contents = parse(readFiles[i], null, true);
        } catch (e) {
          errors.push(createError(file, "parse-error", e.message));
          continue;
        }
      }

      if (!contents) {
        errors.push(
          createError(file, "invalid-format", "Could not parse file")
        );
        continue;
      }

      setIdentifiers(contents, format, store.identifier);

      try {
        const newFile = Object.assign(
          {},
          {
            ...file,
            fileName: file.name, // Save the original filename so we don't overwrite it
            name: file.name,
            lastModified: file.lastModified,
            size: file.size,
            id: id(),
            format,
            ...contents,
          }
        );

        if (contents.noModularResult === undefined && !file.noModularResult) {
          Object.assign(newFile, calcStatistics(contents));
        }

        newFiles.push(newFile);
      } catch (e) {
        errors.push(createError(file, "invalid-format", e.message));
      }
    }

    setFiles([...files, ...newFiles]);

    errors.forEach(({ file, errors }) =>
      onError({
        title: `Could not load ${file.name}`,
        description: errors.map(({ message }) => message).join("\n"),
      })
    );

    setIsLoadingFiles(false);
    console.timeEnd("onDrop");
  };

  const { open, getRootProps, getInputProps } = useDropzone({
    noClick: true,
    accept: acceptedFormats,
    onDropRejected: (rejectedFiles) =>
      rejectedFiles.forEach((rejectedFile) =>
        onError({
          title: `Cannot open ${rejectedFile.file.name}`,
          description: rejectedFile.errors
            .map(({ message }) => message)
            .join("\n"),
        })
      ),
    onDrop,
  });

  const updateFileWithTree = (file, tree) => {
    const index = files.findIndex((f) => f.id === file.id);

    if (index === -1) {
      return;
    }

    try {
      const contents = parse(tree, null, true);

      setIdentifiers(contents, "ftree", store.identifier);

      Object.assign(file, {
        noModularResult: false,
        ...contents,
        ...calcStatistics(contents),
      });

      setFiles(files.map((f) => (f.id === file.id ? file : f)));
    } catch (e) {
      onError({
        title: `Could not parse ${file.name}`,
        description: e.message,
      });
    }
  };

  const createDiagram = useCallback(() => {
    // TODO already loaded?
    // TODO set state from json
    setIsCreatingDiagram(true);
    store.setFiles(files);
    onClose();
  }, [onClose, files, store]);

  const loadExample = useCallback(async () => {
    console.time("loadExample");
    setIsLoadingExample(true);
    setIsLoadingFiles(true);
    try {
      const json = await fetchExampleData();
      setIsLoadingFiles(false);
      //setIsLoadingExample(false);
      setIsCreatingDiagram(true);
      const emptyFile = new File([], exampleDataFilename);
      const files = createFilesFromDiagramObject(json, emptyFile);
      setFiles(files);
      setTimeout(() => {
        store.setFiles(files);
        onClose();
      }, 200);
    } catch (e) {
      onError({
        title: "Could not load example data",
        description: e.message,
      });
      setIsLoadingFiles(false);
      setIsLoadingExample(false);
      setIsCreatingDiagram(false);
    }
    console.timeEnd("loadExample");
  }, [onClose, store, onError]);

  const removeFileId = (id) => {
    const newFiles = files.filter((file) => file.id !== id);
    setFiles(newFiles);
  };

  const toggleMultilayerExpanded = (file) => {
    if (!file.isMultilayer) return;

    if (file.isExpanded === undefined) {
      file.isExpanded = false;
    }

    if (file.isExpanded) {
      const aggregated = Object.assign({}, file);
      aggregated.name = file.fileName;
      aggregated.id = file.originalId;
      aggregated.originalId = undefined;
      aggregated.nodes = [];
      aggregated.numLayers = 0;
      aggregated.isExpanded = false;
      aggregated.layerId = undefined;

      let firstIndex = 0;

      const parts = files.filter((f, i) => {
        const part = f.isMultilayer && f.originalId === file.originalId;
        if (part) {
          firstIndex = Math.min(firstIndex, i);
        }
        return part;
      });

      for (const part of parts) {
        aggregated.numLayers++;
        aggregated.nodes.push(...part.nodes);
      }

      const numTopModules = new Set();
      for (const node of aggregated.nodes) {
        numTopModules.add(node.path[0]);
      }

      aggregated.numTopModules = numTopModules.size;

      Object.assign(aggregated, calcStatistics(aggregated));
      setIdentifiers(aggregated, "tree");

      const newFiles = files.filter((f) => f.originalId !== file.originalId);
      newFiles.splice(firstIndex, 0, aggregated);

      setFiles(newFiles);
    } else {
      const layers = {};

      file.isExpanded = true;
      setIdentifiers(file, "multilayer-expanded");

      file.nodes.forEach((node) => {
        if (!layers[node.layerId]) {
          const layerId = node.layerId;
          const layer = (layers[layerId] = Object.assign({}, file));
          layer.numTopModules = new Set();
          layer.id = id();
          layer.originalId = file.id;

          layer.lastModified = file.lastModified;
          layer.numLayers = 1;
          layer.layerId = layerId;
          layer.size = file.size;
          layer.nodes = [];
          layer.isExpanded = true;

          let layerNameFound = false;
          if (file.layers != null) {
            const name = file.layers?.find((l) => l.id === layerId)?.name;
            if (name != null) {
              layerNameFound = true;
              layer.name = name;
            }
          }

          if (!layerNameFound) {
            layer.name = `Layer ${layerId}`;
          }
        }

        layers[node.layerId].numTopModules.add(node.path[0]);
        layers[node.layerId].nodes.push(node);
      });

      for (const layer of Object.values(layers)) {
        layer.numTopModules = layer.numTopModules.size;
        Object.assign(layer, calcStatistics(layer));
      }

      const index = files.indexOf(file);
      const newFiles = [...files];
      newFiles.splice(index, 1, ...Object.values(layers));
      setFiles(newFiles);

      // Decrease flow threshold as layers contain less flow than an individual file
      // TODO: Show a minimum number of modules per level in each network?
      if (store.flowThreshold > 1e-3) {
        store.setFlowThreshold(1e-3);
      }
    }
  };

  useEventListener("keydown", (event) => {
    if (store.editMode) return;

    if (event?.key === "c" && files.length > 0) {
      createDiagram();
    } else if (event?.key === "e") {
      loadExample();
    }
  });

  const updateIdentifiers = (identifier) => {
    files.forEach((file) => {
      if (file.isExpanded) {
        // No need to do anything
        //setIdentifiers(file, "multilayer-expanded");
      } else if (file.format === "net") {
        if (!file.noModularResult) {
          setIdentifiers(file, "ftree", identifier);
        }
      } else {
        setIdentifiers(file, file.format, identifier);
      }
    });
    store.setIdentifier(identifier);
  };

  const loadLocalStorage = async () => {
    setLocalStorageFiles([]);

    try {
      const ftree = await localforage.getItem("ftree");
      if (!ftree) {
        return;
      }
      const filename = "infomap-online.ftree";
      const blob = new Blob([ftree], { type: "text/plain" });
      const file = new File([blob], filename, { type: "text/plain" });
      setLocalStorageFiles([file]);
    } catch (e) {
      console.warn(e.message);
    }
  };

  useEffect(() => {
    loadLocalStorage();
  }, [setLocalStorageFiles]);

  let activeStep = 1;
  if (files.length > 0) {
    activeStep = files.some((f) => f.noModularResult) ? 0 : 2;
  }

  return (
    <>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Load network partitions</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Stepper
            activeStep={activeStep}
            acceptedFormats={
              "Formats: " +
              acceptedFormats
                .split(",")
                .filter((f) => f !== ".net" && f !== ".stree")
                .map((f) => f.slice(1))
                .join(", ")
            }
          />

          <Skeleton isLoaded={!isLoadingFiles} rounded="md">
            <div
              style={{ background: dropzoneBg }}
              className="dropzone"
              {...getRootProps()}
            >
              <Reorder.Group
                className="parent"
                axis="x"
                layoutScroll
                values={files}
                onReorder={setFiles}
              >
                <AnimatePresence>
                  {files.map((file) => (
                    <Item
                      key={file.id}
                      file={file}
                      onRemove={() => removeFileId(file.id)}
                      onMultilayerClick={() => toggleMultilayerExpanded(file)}
                      setIsRunning={setInfomapRunning}
                      updateFile={updateFileWithTree}
                      onError={onError}
                    />
                  ))}
                </AnimatePresence>
              </Reorder.Group>
              <input {...getInputProps()} />
            </div>
          </Skeleton>
        </ModalBody>

        <ModalFooter>
          <Button
            disabled={
              isLoadingFiles ||
              infomapRunning ||
              isLoadingExample ||
              isCreatingDiagram
            }
            mr={2}
            onClick={loadExample}
            variant="outline"
            isLoading={isLoadingExample}
          >
            Load Example
          </Button>
          <Button
            disabled={
              files.length === 0 ||
              infomapRunning ||
              isLoadingExample ||
              isCreatingDiagram
            }
            onClick={reset}
            leftIcon={<MdOutlineDelete />}
            mr={8}
            variant="outline"
          >
            Clear
          </Button>
          <Box mr="auto">
            <FormLabel fontSize="sm" htmlFor="identifier" mr={0} mb={0}>
              Node Identifier{" "}
              <Tooltip
                hasArrow
                placement="top"
                label="Node identifiers are used to match nodes across different networks. Choose between matching nodes by node id or node name."
              >
                <QuestionOutlineIcon />
              </Tooltip>
            </FormLabel>
            <RadioGroup
              isDisabled={
                files.length === 0 ||
                isLoadingExample ||
                infomapRunning ||
                isCreatingDiagram
              }
              onChange={updateIdentifiers}
              value={store.identifier}
              size="sm"
            >
              <HStack spacing={2}>
                <Radio value="id">Id</Radio>
                <Radio value="name">Name</Radio>
              </HStack>
            </RadioGroup>
          </Box>
          <Box mr={2}>
            <Menu>
              <MenuButton
                disabled={
                  isLoadingFiles ||
                  infomapRunning ||
                  isLoadingFiles ||
                  isCreatingDiagram ||
                  localStorageFiles.length === 0
                }
                as={Button}
                variant="outline"
                rightIcon={<ChevronDownIcon />}
              >
                Local files
              </MenuButton>
              <MenuList>
                {localStorageFiles.map((file, i) => (
                  <MenuItem key={i} onClick={() => onDrop([file])}>
                    {file.name}
                  </MenuItem>
                ))}
                <MenuDivider />
                <MenuItem icon={<RepeatIcon />} onClick={loadLocalStorage}>
                  Refresh
                </MenuItem>
              </MenuList>
            </Menu>
          </Box>
          <Button
            onClick={open}
            disabled={
              isLoadingFiles ||
              infomapRunning ||
              isLoadingExample ||
              isCreatingDiagram
            }
            mr={2}
            variant="outline"
            isActive={files.length === 0}
            leftIcon={<MdUpload />}
          >
            Open
          </Button>
          <Button
            variant="outline"
            disabled={
              files.length === 0 ||
              files.some((f) => f.noModularResult) ||
              infomapRunning ||
              isLoadingExample
            }
            isActive={files.length > 0}
            isLoading={isCreatingDiagram}
            onClick={createDiagram}
          >
            Create Diagram
          </Button>
        </ModalFooter>
      </ModalContent>
    </>
  );
});

function createFilesFromDiagramObject(json, file) {
  // to divide size between networks in file
  const totNodes =
    json.networks
      .map((network) => network.nodes.length)
      .reduce((tot, b) => tot + b, 0) || 1;

  return json.networks.map((network) => {
    setIdentifiers(network, "json");

    return {
      ...file,
      lastModified: file.lastModified,
      size: (file.size * network.nodes.length) / totNodes,
      fileName: file.name,
      name: network.name,
      id: network.id,
      format: "json",
      ...calcStatistics(network),
      ...network,
    };
  });
}

function calcStatistics(file) {
  const flowDistribution = {};
  const layerIds = new Set();

  file.nodes.forEach((node) => {
    const topModule = node.path[0];
    if (!flowDistribution[topModule]) {
      flowDistribution[topModule] = 0;
    }
    flowDistribution[topModule] += node.flow;

    if (node.layerId !== undefined) {
      layerIds.add(node.layerId);
    }
  });

  return {
    flowDistribution,
    isMultilayer: file?.nodes?.[0]["layerId"] !== undefined,
    isStateNetwork: file?.nodes?.[0]["stateId"] !== undefined,
    numLayers: layerIds.size || 1,
  };
}

function setIdentifiers(network, format, identifier = "id") {
  const { nodes } = network;

  const stateOrNodeId = (node) =>
    node.stateId != null ? node.stateId : node.id;

  const getIdentifier = (node) => {
    if (identifier === "id") {
      return stateOrNodeId(node).toString();
    } else if (identifier === "name") {
      return node.name ?? stateOrNodeId(node).toString();
    }
  };

  if (format === "multilayer-expanded") {
    // Expanded multilayer networks must use the physical
    // node id, as the state ids are unique per layer.
    nodes.forEach((node) => (node.identifier = node.id.toString()));
  } else if (format === "json") {
    nodes.forEach((node) => {
      node.identifier = node.identifier ?? getIdentifier(node);
      if (!Array.isArray(node.path)) {
        node.path = TreePath.toArray(node.path);
      }
    });
  } else if (format === "tree" || format === "ftree" || format === "stree") {
    nodes.forEach((node) => (node.identifier = getIdentifier(node)));
  } else if (format === "clu") {
    nodes.forEach((node) => {
      const id = stateOrNodeId(node);
      node.path = node.moduleId.toString();
      node.identifier = id.toString();
      node.name = id.toString();
    });
  }
}
