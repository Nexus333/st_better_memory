# FTS Memory Extension For SillyTavern

*Provide a brief description of how your extension works, what problem it aims to solve.*

This extension re-implements the way long term memory is being handled. Rather than using a vector Database to search for appropriate data to return to context, this performs keyword extraction on the user's prompt then searches through the existing messages in order to find relevant hits.

## Why do this?  (i.e. What's wrong with similarity search?)

The biggest problem with vector search is that it determines which messages to add based on [Semantic similarity](https://www.sbert.net/examples/applications/semantic-search/README.html]).

Effectively this means that it's going to determine that the most appropriate hits to add to context are the ones that are most similar to the prompt being made. 

For example, if you were writing a combat scene, and it searched through relevant messages, the most likely candidates would be other similar combat scenes, because they are the most semantically similar to the input.

So, rather than searching for messages that are semantically similar to the prompt, this extension takes the prompt, and extracts keywords from it, then searches through the existing messages for those keywords, and returns the most relevant hits.

This allows it to return messages that have details relevant to context (much like a search engine), rather than messages that look like the one you're sending.

> Theoretically somewhere down the line this could be used to generate lorebooks from files as well.

## Features

*Describe some of the main selling points of your extension.*

## Installation and Usage

### Installation
- Ensure that you have installed the latest version of SillyTavern's Extra's API.
- Use ST's inbuilt extension installer. 

### Usage

*Explain how to use this extension.*

## Prerequisites

*Specify the version of ST necessary here.*

## Support and Contributions

*Where should someone ask for support?*

*Consider including your own contact info for help/questions.*

*How can people help add to this extension?*

## License

*Be cool, use an open source license.*
