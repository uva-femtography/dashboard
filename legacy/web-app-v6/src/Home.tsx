import { BaseSyntheticEvent, useState } from "react";
import {
  Card,
  FormGroup,
  HTMLSelect,
  NumericInput,
  Button,
  ButtonGroup,
  Spinner,
} from "@blueprintjs/core";
import Results from "./Results";
import createPlot from "./CreatePlot";
import modModel, { modT, modXbj, getModelName, getData } from "./ModOptions";
import { getTabSelected, showError } from "./ManageTab";
import { useEffect } from "react";
import { CSVLink } from "react-csv";

export interface Options {
  //Line 6 allows for strings to be used as indexes
  [key: string]: string | number;
  gpd: string;
  model: string;
  xbj: number;
  t: number;
  q2: number;
}

export type DataPoint = {
  [key: string]: number;
  x: number;
  u: number;
  d: number;
  xu: number;
  xd: number;
};

export type APIData = Array<DataPoint>;

function Home() {
  //Options
  let gpdOptions: string[] = ["GPD_E", "GPD_H"];
  let modelOptions: string[] = ["BKM Model", "UVA Model"];
  let xbjOptions: number[] = [
    0.0001, 0.0002, 0.0004, 0.0006, 0.0008, 0.001, 0.002, 0.004, 0.006, 0.008,
    0.01, 0.02, 0.04, 0.06, 0.08, 0.1, 0.2, 0.4, 0.6,
  ];
  let tOptions: number[] = [...Array(19).keys()].map((n) => -(n + 1) / 10);

  const [xbj, setXbj] = useState(xbjOptions);
  const [t, setT] = useState(tOptions);
  const [q2, setQ2] = useState("");

  const [options, setOptions] = useState<Options>({
    gpd: "GPD_E",
    model: "BKM Model",
    xbj: 0.001,
    t: -0.1,
    q2: 0.1,
  });

  /**
   * ApiData will hold data from the API for plottingAPI Data is an array of arrays. 
   * Each element of the outermost array represent the data that is meant to be 
   * graphed in one tab.
   */
  const [apiData, setApiData] = useState<APIData[][]>([[]]);

  /**
   * 
   * downloadData holds data from the API for downloading into a CSV filedownloadData is different from apiData because it only is concerned with one
   * set of data points retrieved from the API, whereas apiData has to hold data
   * for multiple plots and tabs.
  */
  const [downloadData, setDownloadData] = useState([{}]);
  const [downloadLink, showDownloadLink] = useState(false);

  //Whether to show the spinner or not
  const [showSpinner, setShowSpinner] = useState(false);

  /**
   * This function is used for the q2 form fields. It updates the state with
   * the name of the field and the respective user input.
   */
  function handleQ2(event: BaseSyntheticEvent) {
    setOptionValues(event.target.name, event.target.value);
  }

  /**
   * This is a helper function that updates the state variable optionValues for
   * each of the form fields
   * @param name The name of the option
   * @param value The value that the user selected
   */
  function setOptionValues(name: string, value: string) {
    let newOptions = options;
    newOptions[name] = value;
    setOptions(newOptions);
  }

  /**
   * This function handles the two dropdowns Model and GPD
   * Called whenever the user makes a change to these two dropdowns
   * The function calls modModel which will update the dropdown values
   * for xbj, t, and q2 to reflect the model and GPD chosen by the user
   * @param event When the user changes the model or the GPD
   */
  function handleModelGpd(event: BaseSyntheticEvent) {
    //Updates option values for t
    setOptionValues(event.target.name, event.target.value);
    let model = getModelName(options.model);
    //Updates xbj, t, q2 model values
    modModel(model, options.gpd).then((data) => {
      setXbj(data.xbj);
      setT(data.t);
    });
  }

  /**
   * handleT is called whenever the user makes a change to the t dropdown
   * The function will update xbj and q2 values based on the t value selected
   * @param event When the user changes the t selected
   */
  function handleT(event: BaseSyntheticEvent) {
    //Updates option values for t
    setOptionValues(event.target.name, event.target.value);
    //Ensures that t is a number when function is called
    //Necessary because Javascript converts t into a string
    if (typeof options.t !== "number") {
      options.t = parseFloat(options.t);
    }
    //Updates xbj and q2 based on t value
    modT(getModelName(options.model), options.gpd, options.t)
      .then((data) => {
        setXbj(data.xbj);
        setQ2(`(${data.q2MinMax[0]} to ${data.q2MinMax[1]})`)
      });
  }

  /**
   * handleXbj() updates T and Q2 options based on the Xbj that was
   * selected by the user. It uses modXbj which calls an API to get these
   * values.
   * @param event When the user changes the Xbj selected
   */
  function handleXbj(event: BaseSyntheticEvent) {
    //Setting the options
    setOptionValues(event.target.name, event.target.value);
    //Call API to get new T and Q2 values
    modXbj(getModelName(options.model), options.gpd, options.xbj)
      .then((data) => {
        setT(data.t);
        //Sets Q2 Range
        setQ2(`(${data.q2MinMax[0]} to ${data.q2MinMax[1]})`);
      });
  }

  /**
   * handleSubmit() runs when the user clicks the plot button. The function
   * gets the tab currently selected by the user. Then, handleSubmit() gets the data
   * using the getData() function. The returned value will then be added to the apiData
   * state. Finally, using apiData, the function will call the addPlot() function which will
   * add a plot to the tab selected.
   * @param event When the user clicks the plot button
   * @returns void to stop execution if there is an error
   */
  function handleSubmit(event: BaseSyntheticEvent) {
    //Prevents page from reloading
    event.preventDefault();

    //If tab selected was invalid, stop executing
    const tabSelected = getTabSelected();
    if (tabSelected == null) {
      return;
    } else if (tabSelected === apiData.length) {
      //This runs if there needs to be another array to hold data for another tab
      let addTabData = apiData.slice();
      addTabData.push([]);
      setApiData(addTabData);
    }
    //Show loading spinner
    setShowSpinner(true);

    getData(options.model, options.gpd, options.xbj, options.t, options.q2)
      .then((data) => {
        let updatedData = apiData.slice();
        //Add the data to the index of the tab that was selected
        updatedData[tabSelected].push(data);
        setApiData(updatedData);
        addPlot(tabSelected);
      })
      .catch((error) => {
        showError("Error: Data not found");
        setShowSpinner(false);
        return;
      });
  }

  /**
   * Adds a new plot to the selected tab. If the tab already has a plot on it, the
   * addPlot function will graph overtop of the original plot 
   * @param tabSelected 
   */
  function addPlot(tabSelected: number) {
    createPlot(tabSelected, apiData[tabSelected]);
    setShowSpinner(false);
  }

  /**
   * handleDownload() generates a csv for the user to download when
   * the user clicks the Download button on the UI. The download function
   * uses getData() like the handleSubmit() function, except it does not 
   * add the data to apiData and instead adds it to downloadData instead.
   * 
   */
  function handleDownload() {
    setShowSpinner(true);
    getData(options.model, options.gpd, options.xbj, options.t, options.q2)
      .then((data) => {
        setDownloadData(data);
        showDownloadLink(true);
        let link = document.getElementById("download");
        if (link != null) {
          link.click();
        }
        setShowSpinner(false);
        showDownloadLink(false);
      })
      .catch(() => {
        showError("Error: Data not found");
        setShowSpinner(false);
      });
  }



  useEffect(() => {
    modModel("fake", "GPD_E").then((data) => {
      setXbj(data.xbj);
      setT(data.t);
    });
  }, [])

  return (
    <div className="content">
      <h1>FemtoNet GPD Model Plotting App</h1>
      <hr />

      <div className="container">
        <div className="form">
          <Card>
            <form>
              <FormGroup label="Select GPD:" labelFor="GPD">
                <HTMLSelect
                  options={gpdOptions}
                  name="GPD"
                  onChange={handleModelGpd}
                  required
                />
              </FormGroup>
              <FormGroup label="Select a model:" labelFor="model">
                <HTMLSelect
                  options={modelOptions}
                  name="model"
                  onChange={handleModelGpd}
                  required
                />
              </FormGroup>

              <h2>Kinematic Parameters</h2>

              <FormGroup label="xbj:" labelFor="xbj">
                <HTMLSelect
                  options={xbj}
                  name="xbj"
                  onChange={handleXbj}
                  required
                />
              </FormGroup>

              <FormGroup label="t:" labelFor="t">
                <HTMLSelect
                  options={t}
                  name="t"
                  onChange={handleT}
                  required
                />
              </FormGroup>

              <FormGroup label="q2:" labelFor="q2" labelInfo={q2}>
                <NumericInput
                  stepSize={0.1}
                  name="q2"
                  placeholder="Input a number"
                  onChange={handleQ2}
                  required
                />
              </FormGroup>

              <ButtonGroup>
                <Button
                  type="submit"
                  icon={"series-configuration"}
                  text="Plot"
                  onClick={handleSubmit}
                />

                {!downloadLink && <Button icon={"download"} text="Download" onClick={handleDownload} />}
                {downloadLink && <CSVLink data={downloadData} id={"download"} filename="model.csv">
                  <Button icon={"download"} text="Download" />
                </CSVLink>}
                {showSpinner && <Spinner size={20} />}
              </ButtonGroup>
            </form>
          </Card>
        </div>

        <div className="break"></div>

        <Results />
      </div>
    </div>
  );
}

export default Home;
