import { getContext, extension_settings} from '../../../extensions.js';
import { generateRaw, is_send_press, main_api } from '../../../../script.js';


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
    let res = await generateRaw(prompt+last_message+"### Response:\n", main_api, true);
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
    let msg = msgBlock;
    //console.log("FTS EXTENSION - Block to be Summarized:", msg);
    let result = [];
    let result_dict = {}
    let previous_events = "";

    //process each block in msgBlock
    for(let block_index = 0; block_index < msg.length; block_index++){
        //console.log("FTS EXTENSION - Summarizing Block: ", msg[block_index])
        let msgChunks = await( chunkBlock(msg[block_index]));

        //process each chunk of the message block
        for(let chunk_index = 0; chunk_index < msgChunks.length; chunk_index++){
            //skip empty chunks
            if (msgChunks[chunk_index].length < 2){chunk_index++;}
            //bypass any chunks that end with character name:
            if (msgChunks[chunk_index].endsWith(": ")){chunk_index++;}
            console.log("FTS EXTENSION - Summarizing Chunk: ", msgChunks[chunk_index]);
            let summary = await( summarizeContent(msgChunks[chunk_index], previous_events));
            previous_events = summary;
            summary = summary.replace("- ", "");
            let summary_list = summary.split("\n");
            console.log("FTS EXTENSION - Chunk Summary: ", summary_list);

            //check and store current result length for comparison later.
            let result_length = result.length;

            //fallback in event of failure to outline.
            let previous_result = result;

            //push each of the summaries onto the result array.
            for (let summary_index = 0; summary_index < summary_list.length; summary_index++) {
                if (!result.includes(summary_list[summary_index])) {
                    //ensure that the summary is not empty
                    if (summary_list[summary_index].length > 2){
                        //make sure I'm not adding instructions or contextual information.
                        if (!new RegExp("###|[\[\]]", "g").test(summary_list[summary_index])){
                            result.push(summary_list[summary_index]);
                        }else{
                            //throw away any generated outline. This is probably the LLM hallucinating. Fallback on generating data from the chunk.
                            summary_list = []
                            result = previous_result
                            console.log("FTS EXTENSION - LLM hallucination detected. Falling back to chunk data.")
                        }
                    }
                }
            }

            result = result.filter((el)=> {
                if (el.length > 2){
                    return el;
                }
            });

            //add memories based on default chunk text if the chunk did not add any new memories.
            if (result.length === result_length){
                console.log("FTS EXTENSION - No new events found in chunk, summarizing previous events.");
                //replace all punctuation to . for summarization
                summary = msgChunks[chunk_index].replace(new RegExp("[\.\?\!]", "g"), ".").replace(new RegExp("[\;\:]", "g"), ".").replace(", and", ".").replace(new RegExp("[\"]$", "g"), "\".");
                console.log("FTS EXTENSION - Summarizing Chunk after Failure to Outline: ", summary);
                summary = summary.replace(new RegExp("### .*\: ", "g"), "").replace("\[.*\]", "").replace(new RegExp("^[0-9]*\. ", ""), "").replace(new RegExp("^.*\: ", ""), "").trim();
                summary_list = summary.split(".");

                for (let summary_index = 0; summary_index < summary_list.length; summary_index++) {
                    if (!result.includes(summary_list[summary_index])) {
                        //ensure that the summary is not empty
                        if (summary_list[summary_index].length > 2){
                            //ensure that the summary is not a character name or single word
                            if(summary_list[summary_index].split(" ").length > 3) {
                                //make sure I'm not adding instructions or contextual information.
                                if (!new RegExp("###|[\[\]]", "g").test(summary_list[summary_index])){
                                    result.push(summary_list[summary_index]);
                                }
                            }
                        }
                    }
                }
            }
        }

        result_dict[block_index.toString()+"_actions"] = result;
        let event_block = await consolidateBlockSummary(result)
        let summary = await generateSummaryFromEvents(event_block);
        result_dict[block_index.toString()+"_summary"] = summary;

        console.log("FTS EXTENSION - Block Summarized: "+msg[block_index]+"\nBlock Summary: \n"+result_dict[block_index.toString()+"_summary"] )

        //reset result and events for next block
        result = [];
        previous_events = summary;
    }
}

const chunkBlock = async(msg) => {
    //split the message provided based on paragraphs.
    let msgArray = msg.split("\n");

    //clear empty strings from the array.
    msgArray = msgArray.filter((el)=> {
        return el != "";
    } );
    return msgArray;
}

const summarizeContent = async(msg, previous_events) => {
    //TODO - Instruct mode is currently breaking this.. Need to figure out how to reset before prompting.

    // perform the summarization API call
    let result = "";
    //console.log("FTS EXTENSION - Summarizing: ", msg);
    try {
        const prompt = "### New Roleplay:\n### Instruction:\nExtract and organize the main ideas, concepts, and events below into a chronological, concise list. Format the information as bullet points, focusing on clarity."
        const full_prompt = "[Past Events:\n"+previous_events+"]"+prompt+"\n### Input:\n\nParagraph to Summarize:\n"+msg+"\n### Outline:\n\n-";

        let synopsis = await generateRaw(full_prompt, main_api, true);
        //console.log("FTS EXTENSION - Summarized: ", synopsis);
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

const consolidateBlockSummary = (blockArray) => {
    // let prompt = "### New Roleplay\n### Instruction:Edit the existing content below to create a concise, chronological list of events. Place the information in an ordered list format, consolidating details, removing duplication. Refine the presentation without introducing new content.\n### Input: \n"

    console.log("FTS EXTENSION - Received Events for Block: ", blockArray)
    let blockTemp = [];
    let final_result = "";
    blockTemp.push(blockArray[0]);
    for (let i = 0; i < blockArray.length; i++) {
        //add blockArray[i] to blockTemp if it is not already in blockTemp
        if (!blockTemp.includes(blockArray[i])) {
            blockTemp.push(blockArray[i]);
        }
    }

    for (let i = 0; i < blockTemp.length; i++) {
        final_result += i.toString()+". "+blockTemp[i]+"\n";
    }
    // let result = generateRaw(prompt+"### Result:\n\n", main_api, true);
    console.log("FTS EXTENSION - Consolidated List of Events for Block: ", final_result)
    return final_result;
}

const generateSummaryFromEvents = (eventString) => {
    let prompt = "### New Roleplay\n### Instruction:\nGenerate a summary based on the list of events provided below. Focus on clarity and simplicity.\n### Input: \n"+eventString+"\n### Result:\n\n### Summary:\n";

    let final_result = generateRaw(prompt, main_api, true);
    return final_result;
}

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
        //build up the context string. Replace newlines with the name of the speaker, so it's avail once we chunk out the block.
        let string_to_add = name+": "+context.chat[i].mes+"\n";
        let name_val = string_to_add.split("\n");
        for(let j = 0; j < name_val.length; j++){
            if (name_val[j].length < 2){name_val.splice(j, 1); continue;}
            //if empty lines don't start with the name of the speaker, add the name to the line.
            if (!name_val[j].startsWith(name)){
                name_val[j] = name+": "+name_val[j];
            }
        }
        string_to_add = "";
        for(let j = 0; j < name_val.length; j++){
            string_to_add += name_val[j]+"\n";
        }
        contextString += string_to_add;
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
                    <input id="genmem_button" class="menu_button" type="submit" value="Generate Memories" />
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
    $("#genmem_button").on("click", onMessageUpdate);
    // $("#example_setting").on("input", onExampleInput);

    // Load settings when starting things up (if you have any)
    loadSettings();
});
