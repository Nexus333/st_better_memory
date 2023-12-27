import { getContext, extension_settings} from '../../../extensions.js';
import { generateQuietPrompt, is_send_press} from '../../../../script.js';


// Keep track of where your extension is located, name should match repo name
const extensionName = "st_keyphrase_extraction_fts";
const extensionFolderPath = `scripts/extensions/thirdparty/${extensionName}`;
const extensionSettings = extension_settings[extensionName];
const defaultSettings = {};
let inApiCall = false;



// Loads the extension settings if they exist, otherwise initializes them to the defaults.
async function loadSettings() {
    //Create the settings if they don't exist
    extension_settings[extensionName] = extension_settings[extensionName] || {};
    if (Object.keys(extension_settings[extensionName]).length === 0) {
        Object.assign(extension_settings[extensionName], defaultSettings);
    }

    //Updating settings in the UI
    $("#example_setting").prop("checked", extension_settings[extensionName].example_setting).trigger("input");
}

//perform an button is clicked (later will inject on message submission)
const onMessageUpdate = async() => {
    // Generation is in progress, summary prevented
    const prompt = "### Instruction:\n Generate 3 keywords or phrases from the following text as a comma separated list: "
    if (is_send_press) {
        return;
    }
    const context = getContext();
    let last_message = context.chat[context.chat.length-1].mes;
    console.log("FTS EXTENSION - Message updated: ", last_message);
    let res = await generateQuietPrompt(prompt+last_message+"### Response:\n");
    let res2 = res.split(",");
    if (res2.length ==1) {
        res2 = res2 = res.split("\n");
    }
    res = res2;
    for (let i = 0; i < res.length; i++) {
        res[i] = res[i].replace(new RegExp("^[0-9]*\. ", ""), "").replace(new RegExp("^.*\: ", ""), "").trim();
    }
    console.log("FTS EXTENSION - Response: ", res);
    let msgBlock = grabMessageBlock();
    //console.log("FTS EXTENSION - Message Block: ", msgBlock);
    //let result = summarizeBlock(msgBlock);
    summarizeBlockData(msgBlock);
    //console.log(result);
};

const summarizeBlockData = async(msgBlock) => {
    let msg = msgBlock[0];
    let result = [];
    let result_dict = {}
    let summary_part = msg.split("\n");
    for (let i = 0; i < summary_part.length; i++) {
        console.log("FTS EXTENSION - Summarizing: ", msg)
        let summary = await( summarizeContent(summary_part[i]));
        summary = summary.replace("- ", "");
        let summary_list = summary.split("\n");
        for (let j = 0; j < summary_list.length; j++) {
            result.push(summary_list[j]);
        }
        result_dict[i.toString()] = result;
        result = [];
        console.log("FTS EXTENSION - Summarized: ", result_dict)
    }
}

const summarizeContent = async(msg) => {
    // perform the summarization API call
    let result = "";
    console.log("FTS EXTENSION - Summarizing: ", msg);
    try {
        const prompt = "STOP ROLEPLAY. Provide an outline in bullet format for the SAMPLE TEXT below. IGNORE DETAILS and capture the core events and concepts." +
            "\n\nSAMPLE TEXT: \n"+ msg+
            "\n### Response:\n";

        let synopsis = await generateQuietPrompt(prompt);
        console.log("FTS EXTENSION - Summarized: ", synopsis);
        result = synopsis;
    }
    catch (error) {
        console.log(error);
    }
    finally {
        inApiCall = false;
    }
    return result;
};

const grabMessageBlock= () => {
    const context = getContext();
    let contextString = "";
    for (let i = 0; i < context.chat.length; i++) {
        let name = "unset";
        if (context.chat[i].is_user == true) {
            console.log("FTS EXTENSION - Context block split triggered!")
            if (i>2){ name = "###SPLIT"+context.chat[i].name;}
        }
        else {
            name = context.chat[i].name;
        }
        contextString += name+": "+context.chat[i].mes + "\n";
    }
    contextString = contextString.split("###SPLIT");
    return contextString;
}

// This function is called when the extension is loaded
jQuery(async () => {
    // This is an example of loading HTML from a file
    const settingsHtml = `
    <div class="example-extension-settings">
        <div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header">
                <b>Better Memory</b>
                <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
            </div>
            <div class="inline-drawer-content">
                <div class="example-extension_block flex-container">
                    <input id="my_button" class="menu_button" type="submit" value="Example Button" />
                </div>

                <div class="example-extension_block flex-container">
                    <input id="example_setting" type="checkbox" />
                    <label for="example_setting">This is an example</label>
                </div>

                <hr class="sysHR" />
            </div>
        </div>
    </div>
`;
    $("#extensions_settings").append(settingsHtml);

    // These are examples of listening for events
    $("#my_button").on("click", onMessageUpdate);
    // $("#example_setting").on("input", onExampleInput);

    // Load settings when starting things up (if you have any)
    loadSettings();
});
