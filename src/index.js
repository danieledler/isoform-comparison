import React from "react";
import { hydrate, render } from "react-dom";
import App from "./components/App";
import "./index.css";
import { unregister } from "./registerServiceWorker";


const rootElement = document.getElementById("root");
if (rootElement.hasChildNodes()) {
  hydrate(<App/>, rootElement);
} else {
  render(<App/>, rootElement);
}

unregister();
