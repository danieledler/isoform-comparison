import { Flex, Heading, Text } from "@chakra-ui/react";
import { observer } from "mobx-react";
import { useContext, useState } from "react";
import { StoreContext } from "../../store";
import StepHeading from "./StepHeading";
import AlignSequences from "./AlignSequences";
import LoadData from "./LoadData";
import PartitionNetworks from "./PartitionNetworks";
import InputTextArea from "./InputTextArea";
import useEventListener from "../../hooks/useEventListener";
import IsoformAlluvialDiagram from "./IsoformAlluvialDiagram";

export default observer(function IsoformApp() {
  const store = useContext(StoreContext);
  const [activeStep, setActiveStep] = useState(1);
  useEventListener("keydown", (event) => {
    // @ts-ignore
    const key = event?.key;
    if (!store.editMode && key === "e") {
      store.input.loadExample(store.input.exampleData[0]);
    }
  });
  console.log("!Render IsoformApp");

  return (
    <Flex mt="100px" direction="column" alignItems="center">
      <Flex id="step1" direction="column" alignItems="center" mb={20}>
        <StepHeading step={1} title="Load data" active={activeStep == 1} />

        <Text>Paste or load your own data below or load example data.</Text>

        <Flex mt={6}>
          <Flex direction="column">
            <Heading as="h3" size="sm" mb={2}>
              Isoform 1
            </Heading>
            <InputTextArea
              isoID={1}
              width="500px"
              height="150px"
              placeholder="Paste gene sequence here (.fasta file)"
              onLoadContent={() => {}}
            />

            <InputTextArea
              isoID={1}
              width="500px"
              height="150px"
              placeholder="Paste gene 3D structure here (.pdb file from AlphaFold)"
              onLoadContent={() => {}}
              mt="20px"
            />
          </Flex>
          <Flex direction="column" mx={4}>
            <Heading as="h3" size="sm" mb={2}>
              &nbsp;
            </Heading>
            <LoadData />
          </Flex>

          <Flex direction="column">
            <Heading as="h3" size="sm" mb={2}>
              Isoform 2
            </Heading>
            <InputTextArea
              isoID={2}
              width="500px"
              height="150px"
              placeholder="Paste gene sequence here (.fasta file)"
              onLoadContent={() => {}}
            />

            <InputTextArea
              isoID={2}
              width="500px"
              height="150px"
              placeholder="Paste gene 3D structure here (.pdb file from AlphaFold)"
              onLoadContent={() => {}}
              mt="20px"
            />
          </Flex>
        </Flex>
      </Flex>

      <Flex id="step2" direction="column" alignItems="center" mb={20}>
        <StepHeading step={2} title="Align sequences" />

        <AlignSequences />

        <Flex mt={8}></Flex>
      </Flex>

      <Flex id="step3" direction="column" alignItems="center" mb={20}>
        <StepHeading step={3} title="Generate and partition networks" />

        <PartitionNetworks />

        <Flex mt={8}></Flex>
      </Flex>

      <Flex id="step4" direction="column" alignItems="center" mb={20}>
        <StepHeading step={4} title="Compare structures" />
        <p>Explore modular differences</p>

        <IsoformAlluvialDiagram />
      </Flex>
    </Flex>
  );
});
