# Better Memory For SillyTavern

*Provide a brief description of how your extension works, what problem it aims to solve.*

This extension re-implements the way long term memory is being handled. 

Rather than using a vector Database to search for appropriate data to return to context:

1. You can generate memories from the chat log, by using your LLM to generate a list of discrete events and summaries for chat blocks.
1. These are then stored to world info with the keys corresponding to the events (effectively memory triggers), and the summary as the content of the Lorebook.
1. When a prompt is made, the extension will extract keywords from the prompt, and search through the existing memories for the most relevant hits.
1. If multiple hits are found, it will pass this to vector search to determine the most appropriate hit to return to context.
1. Lastly, it injects the summary of the memory into the chat log, and returns it to context. 

Effectively this should allow it to have whatever contextual information is necessary to respond to the prompt, rather than just returning the most semantically similar messages.

Additionally, since the summaries and events are stored in world info, you can adjust the details if the LLM hallucinates.

## Why do this?  (i.e. What's wrong with similarity search?)

The biggest problem with vector search is that it determines which messages to add based on [Semantic similarity](https://www.sbert.net/examples/applications/semantic-search/README.html]).

Effectively this means that it's going to determine that the most appropriate hits to add to context are the ones that are most similar to the prompt being made. 

For example, if you were writing a combat scene, and it searched through relevant messages, the most likely candidates would be other similar combat scenes, because they are the most semantically similar to the input.


> Theoretically somewhere down the line this could be used to generate lorebooks from files as well.



## Features

- Iterative summaries of the chat that can be triggered both through the tool and externally.
- A better use for Vector Search. (Essentially Fuzzy Search, which is what Semantic similarity excels at.)
- More consistent responses from your Characters. No more goldfish Memory.
- A more robust way to handle long term memory.
- It's super cool to see an event log of your RP. :D 
- Long term storage of story summaries taken iteratively. Essentially checkpoints of the story.

## Downsides
- Generating summaries and events is slow. Which is why they're persisted to world info. This can take several minutes to run through your chat since it requires multiple passes through generation to create.
- Since this uses the same API that the user uses for generation, it will block generation while memory generation is occurring (This is why I opted to have it triggerred manually). 
- It's not a perfect solution, but it's a better one than what we have now.
- Requires external API to work, since I had trouble getting some internal API to work.
- Adds a couple of seconds to generation when used. 
- Haven't tested it extensively on all models, so far just Psyfighter and Mythalion, so your mileage may vary. Don't expect this to be an issue with any of the major services, but some of the smaller models may have issues?? (I don't know, I haven't tested it.)
- There's probably some issues, since I didn't put all the guards I possibly could have in place. Assume that this is a PoC, and not a production ready extension.
- This is designed for Narrative summary. If you try to use it to summarize for something other than stories or chats, it'll probably be bad news bears.. :shrug:

## Installation and Usage

### Installation
- Install the Extension from the SillyTavern Extension Manager.
- You'll need to run my Vector API extension which contains some endpoints to hit chroma and RAKE for keyword extraction. (I may fix this later on, but for now it's a dependency.) [LVAK](https://github.com/Nexus333/LVAK)
- Ensure LVAK is running before you trigger the extension. (Needed for Keyword Extraction, and vector comparison.)
- Ensure that you are connected to an API. 
- Ensure that you are in a chat. 

### Usage

1. Install the extension.
2. Select an existing chat. This summaries in chunks of User / Responses. So if you don't have any data or little data, it's probably going to do something dumb. I haven't really tested it on small datasets. 
3. Click the "Generate Memories" button.
4. Wait for it to finish. (This can take a while.)
5. Hit the "Find Memories button when prompting."
6. Profit???

## Prerequisites

* Latest is probably fine. Haven't checked older versions. :shrug:

## Support and Contributions

*Where should someone ask for support?*

I mainly just build stuff for myself, but figured others might want to give it a try. 

If you have questions, you can ask me on the SillyTavern Discord. 

I'm pretty busy, but I'll probably get back to you eventually.

*How can people help add to this extension?*

Whatever works. :shrug:

## License

- MIT License
- Fork or w/e. I don't care.
