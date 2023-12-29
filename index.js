import { getContext, extension_settings} from '../../../extensions.js';
import { generateRaw, getRequestHeaders, is_send_press, main_api } from '../../../../script.js';
import { executeSlashCommands } from '../../../slash-commands.js';
import { getStringHash } from '../../../utils.js';

// Keep track of where your extension is located, name should match repo name
const extensionName = "better_memory";
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
    $("#rake_setting").prop("checked", extension_settings[extensionName].rake_setting).trigger("input");
}

//button that summarizes memories. FYI this takes a while. It's not a fast process.
const onSummarizeMemories = async() => {
    let context = getContext();
    const messages = context.chat;
    await executeSlashCommands("/send \"Generating Memories... Please avoid generation till complete.\"")
    let msgBlock = grabMessageBlock();
    await summarizeBlockData(msgBlock);
    await executeSlashCommands("/send \"Memories Generated.\"");
    context.chat.splice(messages.length-3, 2);

};


const onFindMemories = async() => {
    let resp = await onLocateMemories("Lilith sits down next to Dirge by a campfire in ancient ruins.");
}

const onLocateMemories = async(msgPrompt) => {
    //keyword generation
    let rake_keys = [];
    let llm_keys = [];
    let resultString = "";
    if (true) {
        rake_keys = await generateRakeKeywords(msgPrompt);
        llm_keys = await generateKeywordsFromLLM(msgPrompt, rake_keys);
    }else{
        llm_keys = await generateKeywordsFromLLM(msgPrompt);
    }
    console.log("BETTER MEMORY - Rake Keys: ", rake_keys);
    console.log("BETTER MEMORY - LLM Keys: ", llm_keys);

    let wi_events = []
    //get Key phrases from WI
    console.log("BETTER MEMORY - Searching through World Info with the following Keywords and Phrases: ", llm_keys);
    for (let i = 0; i < llm_keys.length; i++) {
        console.log("BETTER MEMORY - WI Keyphrase: ", llm_keys[i]);
        let wi_keys = await getLorebookContent(llm_keys[i], false);
        console.log("BETTER MEMORY - WI Keys: ", wi_keys);
        for (let j = 0; j < wi_keys.length; j++) {
            wi_events.push(wi_keys[j]);
        }
    }
    console.log("BETTER MEMORY - Found Memory Triggers: ", wi_events)

    if (wi_events.length < 1) {
        console.log("BETTER MEMORY - No Memories Found.")
        resultString = "";
    }else if (wi_events.length === 1){
        console.log("BETTER MEMORY - Single Memory Found.")
        resultString = await getLorebookContent(wi_events[0], true);
    }else{
        console.log("BETTER MEMORY - Multiple Memories Found. Filtering using Vectorization.")
        await insertKeyPhrases(wi_events).then(async() => {
            await queryVectors(msgPrompt).then(async(data) => {
                console.log("BETTER MEMORY - Query Result: ", data["chroma_resp"]);
                console.log("BETTER MEMORY - Query Results Type: ", typeof data["chroma_resp"]);
                let llm_results =data["chroma_resp"];
                console.log("BETTER MEMORY - LLM Results: ", llm_results);
                let llm_docs = llm_results["documents"][0];
                console.log("BETTER MEMORY - Searching BEST Match: ", llm_docs[0]);
                resultString = await getLorebookContent(llm_docs[0], true);
            })
        });
    }
    console.log("BETTER MEMORY - Memory Selected: ", resultString);
    return resultString;
}

const generateKeywordsFromLLM = async(message, proposedKeywordsArray=[], removeCharacterNames=true) => {
    // Generation is in progress, summary prevented
    const prompt = "### Instruction:\n Generate 3 keywords or phrases from the following text as a comma separated list: "
    let keyword_list = "";
    if (is_send_press) {
        return;
    }

    if (proposedKeywordsArray.length > 0){
        for (let i = 0; i < proposedKeywordsArray.length; i++) {
            keyword_list += proposedKeywordsArray[i]+", ";
        }
    }

    const context = getContext();
    const proposedKeywordsPrompt = "[Proposed Keywords: "+keyword_list+"]";
    console.log("BETTER MEMORY - Generating keywords for Message: ", message);
    let res = await generateRaw(proposedKeywordsPrompt+prompt+message+"### Response:\n", main_api, true);
    let res2 = res.split(",");
    if (res2.length ==1) {
        res2 = res2 = res.split("\n");
    }
    res = res2;

    for (let i = 0; i < res.length; i++) {
        res[i] = res[i].replace(new RegExp("^[0-9]*\. ", ""), "").replace(new RegExp("^.*\: ", ""), "").trim();
    }

    if (removeCharacterNames){
        let characters = await getSceneCharacters();
        let data = res;
        for (let i = 0; i < data.length; i++) {
            //remove data if contains character name in characters array.
            for (let j = 0; j < characters.length; j++) {
                if (data[i].toLowerCase().includes(characters[j].toLowerCase())){
                    data.splice(i, 1);
                }
            }
        }
        res = data;
    }

    console.log("BETTER MEMORY - Response: ", res);
    return res;
}

const generateRakeKeywords = async(message, removeCharacterNames=true) => {
    if (is_send_press) {
        return;
    }
    let data = [];
    await fetch('http://localhost:18000/keywordgen', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({
            prompt: message
        }),
    }).then(response => response.json()).then(dat => {
        data = dat["keywords"];
    });

    console.log("BETTER MEMORY - Generating keywords for Message: ", message);
    console.log("BETTER MEMORY - Proposed Keywords were: ", data);
    if (removeCharacterNames){
        let characters = await getSceneCharacters();
        for (let i = 0; i < data.length; i++) {
            //remove data if contains character name in characters array.
            for (let j = 0; j < characters.length; j++) {
                if (data[i].toLowerCase().includes(characters[j].toLowerCase())){
                    data.splice(i, 1);
                }
            }
        }
    }

    return data;
}


const summarizeBlockData = async(msgBlock) => {
    let msg = msgBlock;
    //For Testing purposes, only summarize the first block.
    // let msg =[];
    // msg.push(msgBlock[0]);

    //console.log("BETTER MEMORY - Block to be Summarized:", msg);
    let result = [];
    let result_dict = {}
    let previous_events = "";
    let blocks_hashed = [];
    let loaded_hashes = [];

    //load block hashes from WI
    try{
        loaded_hashes = await getLorebookContent("blocks_hashed", true).then((data) => {
            console.log(JSON.stringify(data))
            return data[0].content.split("\n");
        });
        console.log("BETTER MEMORY - Loaded Hashes: ", loaded_hashes);
    }catch(e){
        console.log("BETTER MEMORY - No Hashes Loaded: ", e);
    }

    //process each block in msgBlock
    for(let block_index = 0; block_index < msg.length; block_index++){
        //console.log("BETTER MEMORY - Summarizing Block: ", msg[block_index])
        let block_hash = getStringHash(msg[block_index]);
        //check if the block has already been summarized.
        if (loaded_hashes.includes(block_hash.toString())){
            console.log("BETTER MEMORY - Block already summarized. Skipping.");
            //skip the block if it has already been summarized.
            continue;
        }
        else{
            console.log("BETTER MEMORY - Summarizing Block with Hash: ",block_hash);
            let msgChunks = await( chunkBlock(msg[block_index]));

            //process each chunk of the message block
            for(let chunk_index = 0; chunk_index < msgChunks.length; chunk_index++){
                //skip empty chunks
                if (msgChunks[chunk_index].length < 2){chunk_index++;}
                //bypass any chunks that end with character name:
                if (msgChunks[chunk_index].endsWith(": ")){chunk_index++;}
                console.log("BETTER MEMORY - Summarizing Chunk: ", msgChunks[chunk_index]);
                let summary = await( summarizeContent(msgChunks[chunk_index], previous_events));
                previous_events = summary;
                summary = summary.replace("- ", "");
                let summary_list = summary.split("\n");
                console.log("BETTER MEMORY - Chunk Summary: ", summary_list);

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
                                result.push(summary_list[summary_index].replace("- ", "").replaceAll('*', ""));
                            }else{
                                //throw away any generated outline. This is probably the LLM hallucinating. Fallback on generating data from the chunk.
                                summary_list = []
                                result = previous_result
                                console.log("BETTER MEMORY - LLM hallucination detected. Falling back to chunk data.")
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
                    console.log("BETTER MEMORY - No new events found in chunk, summarizing previous events.");
                    //replace all punctuation to . for summarization
                    summary = msgChunks[chunk_index].replace(new RegExp("[\.\?\!]", "g"), ".").replace(new RegExp("[\;\:]", "g"), ".").replace(", and", ".").replace(new RegExp("[\"]$", "g"), "\".");
                    console.log("BETTER MEMORY - Summarizing Chunk after Failure to Outline: ", summary);
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
                                        result.push(summary_list[summary_index].replace ("- ", "").replaceAll('*', ""));
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

            console.log("BETTER MEMORY - Block Summarized: "+msg[block_index]+"\nBlock Summary: \n"+result_dict[block_index.toString()+"_summary"] )
            result.push("Block_"+block_index.toString());
            saveDataToWorldInfo(result, summary);

            //reset result and events for next block
            result = [];
            previous_events = summary;

            //add block hash to list of hashed blocks
            blocks_hashed.push(block_hash);
        }
    }
    //check if any blocks were hashed
    if (blocks_hashed.length > 0) {
        //add hashed blocks to loaded hashes
        for (let i = 0; i < blocks_hashed.length; i++) {
            loaded_hashes.push(blocks_hashed[i]);
        }
        //save loaded hashes to WI
        await executeSlashCommands("/createentry file=" + getLorebookName() + " key=\"blocks_hashed\" " + loaded_hashes.join("\n"));
    }
}

//get WI content
const getLorebookContent = async(keyword, content=true) => {
    const lorebook_name = getLorebookName()
    const sourcepath = '../../../../worlds/';
    let world_info="";
    let hits = [];
    //Can't get the f ing UID to work. Loading in the json directly till I figure it out.
    // let UID = "";
    // let content_result = "No Content Found.";
    // try{
    //     UID = getEntryUID(keyword)
    //     console.log("BETTER MEMORY - Lorebook UID for keyword (", keyword, " set to : ", UID)
    //     content_result = await executeSlashCommands("/getentryfield file="+lorebook_name+" field=content "+UID);
    //     console.log("BETTER MEMORY - Lorebook Content for : ", lorebook_name, " : ", content_result)
    // }catch(e){
    //     console.log("BETTER MEMORY - Lorebook Content for : ", lorebook_name, " does not exist: ", e, "UID: ", UID);
    // }
    //
    // return content_result;

    //load the json file directly and search for the keyword.
    await fetch(sourcepath+lorebook_name+".json").then(response => response.json()).then(data => {
        world_info = data;
    });
    console.log("BETTER MEMORY - Lorebook Content for : ", lorebook_name, " : ", world_info)
    for (const [key, value] of Object.entries(world_info.entries)) {
        console.log("BETTER MEMORY - Checking WI for keyword: ", keyword, "at key: ", key);
        let keyArray = value.key;
        //iterate through the keys to check if the keyword is present.
        for (let i = 0; i < keyArray.length; i++) {
            if (keyArray[i].includes(keyword)){
                if (content === true) {
                    console.log("BETTER MEMORY - Found matching WI Content: " , value.content, "at UID: ", value.uid);
                    hits.push(value);
                }else{
                    console.log("BETTER MEMORY - Found matching WI Keyphrase: " , keyArray[i]);
                    hits.push(keyArray[i]);
                }
            }
        }
    }

    return hits;
}

const getLorebookName = () => {
    const context = getContext();
    let chat_id = context.chatId;
    const lorebook_name = chat_id.replace("-", "_").replaceAll(" ", "").replace(new RegExp("\@.*$", ""), "")+"_memories";
    return lorebook_name;
}

const getEntryUID = async(keyword) => {
    let UID = await(executeSlashCommands("/findentry file="+getLorebookName()+" field=key \""+keyword+"\""));
    console.log("BETTER MEMORY - UUID Set to ", UID, " for keyword: ", keyword);
    return UID;
}

const getSceneCharacters = async() => {
    const context = getContext();

    //placeholder to return characters later on.
    let characters = [];

    //Check if this is a group vs 1 on 1 chat.
    console.log("BETTER MEMORY - Checking if group chat: ", context.groupId, " Context: ", context);
    if (context.groupId === null){
        characters.push(context.name1)
        characters.push(context.name2)
    }else{
        //get name based on group members out of context.
        let group_id = context.groupId;
        let group_members = context.groups[group_id].members;
        for (let i = 0; i < context.characters.length; i++) {
            if (group_members.includes(context.characters[i].avatar)){
                characters.push(context.characters[i].name);
            };
        }
    }
    return characters;
}


const saveDataToWorldInfo = async(eventArray, summary) => {
    //Don't create entries if there are no events.
    if (eventArray.length < 1) {
        return;
    }
    //don't try to persist a summary if it's empty.
    if (summary.length < 1) {
        return;
    }

    //Keywords String Variable
    let keywords = "";
    let content_result = "";

    const lorebook_name = getLorebookName();
    console.log("BETTER MEMORY - Creating Lorebook for : ", lorebook_name);
    for(let i = 0; i < eventArray.length; i++) {
        let event_keyword = eventArray[i].replace(new RegExp("^[0-9]*\. ", ""), "").replace("\"", "").replaceAll(",", "").trim();
        //update the keywords string
        keywords += event_keyword+", ";
    }
    //remove the last comma and space from the keywords string.
    keywords = keywords.slice(0, -2);

    await executeSlashCommands("/createentry file="+lorebook_name+" key=\""+keywords+"\" "+summary);

    await executeSlashCommands("/createentry file="+lorebook_name+" key=\"memoryKeywords\" "+keywords);
    console.log("BETTER MEMORY - Lorebook Created for : ", lorebook_name);

    //verify last entry exists
    console.log("BETTER MEMORY - Verifying last entry in : ", lorebook_name);
    try{
        let content = await getLorebookContent(eventArray[eventArray.length-1]);
        console.log("BETTER MEMORY - Last entry in : ", lorebook_name, " content: ", content);
    }catch(e){
        console.log("BETTER MEMORY - Unable to access last entry in ", lorebook_name, ": ", e);
    }
}

const queryVectors = async(queryString) => {
    // const response = await fetch('/api/vector/query', {
    //     method: 'POST',
    //     headers: getRequestHeaders(),
    //     body: JSON.stringify({
    //         collectionId: getLorebookName(),
    //         searchText: queryString,
    //         topK: 3,
    //         source: "transformers",
    //     }),
    // });

    const response = await fetch('http://localhost:18000/data/', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({
            collection: getLorebookName(),
            query: [queryString],
            n_results: 3
        }),
    });

    if (!response.ok) {
        throw new Error(`Failed to query collection ${getLorebookName()}: `);
    }

    const results = await response.json();
    return results;
}

//insert keys as vectors
const insertKeyPhrases = async(keyphraseArray) => {
    // const response = await fetch('/api/vector/insert', {
    //     method: 'POST',
    //     headers: getRequestHeaders(),
    //     body: JSON.stringify({
    //         collectionId: getLorebookName(),
    //         items: keyphraseArray,
    //         source: 'transformers',
    //     }),
    // });

    const response = await fetch('http://localhost:18000/data/', {
        method: 'PUT',
        headers: getRequestHeaders(),
        body: JSON.stringify({
            collection: getLorebookName(),
            documents: keyphraseArray,
        }),
    });

    if (!response.ok) {
        throw new Error(`Failed to insert vector items for collection ${getLorebookName()}`);
    }
    console.log("BETTER MEMORY - Inserted vector items for collection "+getLorebookName(), " : \n", response.json());
}

//purge vector store
async function purgeVectorIndex() {
    try {

        // const response = await fetch('/api/vector/purge', {
        //     method: 'POST',
        //     headers: getRequestHeaders(),
        //     body: JSON.stringify({
        //         collectionId: getLorebookName(),
        //     }),
        // });

        const response = await fetch('http://localhost:18000/data/', {
            method: 'DELETE',
            headers: getRequestHeaders(),
            body: JSON.stringify({
                collection: getLorebookName(),
            }),
        });

        if (!response.ok) {
            throw new Error(`Could not delete vector index for collection ${getLorebookName()}`);
        }

        console.log(`Vectors: Purged vector index for collection ${getLorebookName()}`);

    } catch (error) {
        console.error('Vectors: Failed to purge', error);
    }
    console.log("BETTER MEMORY - Purge Vector DB Completed with result: ", JSON.stringify(response.json()));
}

//Placemarker for future functionality. This currently isn't exposed. Has to be deleted manually through the UI.
// const purgeMemories = async() => {
//
// }

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
    // perform the summarization API call
    let result = "";
    //console.log("BETTER MEMORY - Summarizing: ", msg);
    try {
        const prompt = "### New Roleplay:\n### Instruction:\nExtract and organize the main ideas, concepts, and events below into a chronological, concise list. Format the information as bullet points, focusing on clarity."
        const full_prompt = "[Past Events:\n"+previous_events+"]"+prompt+"\n### Input:\n\nParagraph to Summarize:\n"+msg+"\n### Outline:\n\n-";

        let synopsis = await generateRaw(full_prompt, main_api, true);
        //console.log("BETTER MEMORY - Summarized: ", synopsis);
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

    console.log("BETTER MEMORY - Received Events for Block: ", blockArray)
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
    console.log("BETTER MEMORY - Consolidated List of Events for Block: ", final_result)
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
            console.log("BETTER MEMORY - Context block split triggered!")
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
                    <input id="locmem_button" class="menu_button" type="submit" value="Locate Memories" />
                </div>
                <div class="example-extension_block flex-container">
                    <input id="rake_setting" type="checkbox" />
                    <label for="rake_setting">Use Rake For Keyword Extraction</label>
                </div>

                <hr class="sysHR" />
            </div>
        </div>
    </div>
`;
    $("#extensions_settings").append(settingsHtml);

    // These are examples of listening for events
    $("#genmem_button").on("click", onSummarizeMemories);
    $("#locmem_button").on("click", onFindMemories);
    // $("#rake_setting").on("input", onExampleInput);

    // Load settings when starting things up (if you have any)
    loadSettings();
});
