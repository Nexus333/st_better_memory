import { getStringHash, debounce, waitUntilCondition, extractAllWords } from '../../../utils.js';
import { getContext, getApiUrl, extension_settings, loadExtensionSettings, doExtrasFetch, modules } from '../../../extensions.js';
import { animation_duration, eventSource, event_types, extension_prompt_types, generateQuietPrompt, is_send_press, saveSettingsDebounced, substituteParams } from '../../../../script.js';
import { is_group_generating, selected_group } from '../../../group-chats.js';
import { registerSlashCommand } from '../../../slash-commands.js';
import { loadMovingUIState } from '../../../power-user.js';
import { dragElement } from '../../../RossAscends-mods.js';
import { getTextTokens, tokenizers } from '../../../tokenizers.js';

// export { MODULE_NAME };
//
// const MODULE_NAME = 'fts_memory';


// Keep track of where your extension is located, name should match repo name
const extensionName = "st_keyphrase_extraction_fts";
const extensionFolderPath = `scripts/extensions/thirdparty/${extensionName}`;
const extensionSettings = extension_settings[extensionName];
const defaultSettings = {};



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

//perform an action when message is sent.
async function onMessageUpdate(){
  const context = getContext();
  let last_message = context.chat[context.chat.length-1].mes;
  console.log("Message updated", last_message);
};

//
// // This function is called when the extension settings are changed in the UI
// function onExampleInput(event) {
//   const value = Boolean($(event.target).prop("checked"));
//   extension_settings[extensionName].example_setting = value;
//   saveSettingsDebounced();
// }
//
// // This function is called when the button is clicked
// function onButtonClick() {
//   // You can do whatever you want here
//   // Let's make a popup appear with the checked setting
//   toastr.info(
//     `The checkbox is ${extension_settings[extensionName].example_setting ? "checked" : "not checked"}`,
//     "A popup appeared because you clicked the button!"
//   );
// }

// This function is called when the extension is loaded
jQuery(async () => {
  // This is an example of loading HTML from a file
  const settingsHtml = `
    <div class="example-extension-settings">
        <div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header">
                <b>Extension Example</b>
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

  // Append settingsHtml to extensions_settings
  // extension_settings and extensions_settings2 are the left and right columns of the settings menu
  // Left should be extensions that deal with system functions and right should be visual/UI related 
  $("#extensions_settings").append(settingsHtml);

  // These are examples of listening for events
  $("#my_button").on("click", onMessageUpdate());
  // $("#example_setting").on("input", onExampleInput);

  // Load settings when starting things up (if you have any)
  loadSettings();
});
