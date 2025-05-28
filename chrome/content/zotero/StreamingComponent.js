import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { StreamingStatusTag, StreamingStates } from './StreamingStatusTag';

const StreamingComponent = ({ streamText, hideStreamResponse }) => {
    const [streamingState, setStreamingState] = useState(StreamingStates.Default);
    const [thinkingText, setThinkingText] = useState('');
    const [responseText, setResponseText] = useState('');
    const [pastStatuses, setPastStatuses] = useState([]);

    useEffect(() => {
        setPastStatuses([...pastStatuses, streamingState]);
    }, [streamingState]);

    useEffect(() => {
        if (streamText.includes('</appendix> ')) {
            setStreamingState(StreamingStates.Appendix);
        } else if (streamText.includes('<followup_question>')) {
            setStreamingState(StreamingStates.FollowUpQuestions);
        } else if (streamText.includes('<source_page>')) {
            setStreamingState(StreamingStates.SourcePage);
        } else if (streamText.includes('<sources>')) {
            setStreamingState(StreamingStates.Sources);
        } else if (streamText.includes('<response>')) {
            setStreamingState(StreamingStates.Response);
        } else if (streamText.includes('<thinking>')) {
            setStreamingState(StreamingStates.Thinking);
        } else if (streamText.includes('<id>')) {
            setStreamingState(StreamingStates.Id);
        }
    }, [streamText]);

    const removeSubstrings = (originalString, substringsToRemove) => {
        let currentString = originalString;
        for (let i = 0; i < substringsToRemove.length; i += 1) {
            const substring = substringsToRemove[i];
            if (typeof substring === 'string') {
                const index = currentString.indexOf(substring);
                if (index !== -1) {
                    currentString =
                        currentString.slice(0, index) +
                        currentString.slice(index + (substring?.length || 0));
                }
            }
        }
        return currentString;
    };

    useEffect(() => {
        const thinkingIndex = streamText.includes('<thinking>')
            ? streamText.indexOf('<thinking>') + '<thinking>'.length
            : -1;
        const endThinkingIndex = streamText.indexOf('</thinking>');
        if (endThinkingIndex !== -1) {
            setThinkingText(
                removeSubstrings(
                    streamText.substring(thinkingIndex, endThinkingIndex),
                    ['<think>', '</think>'],
                ),
            );
        } else if (thinkingIndex !== -1) {
            setThinkingText(
                removeSubstrings(streamText.substring(thinkingIndex), [
                    '<think>',
                    '</think>',
                ]),
            );
        }

        const responseIndex = streamText.includes('<response>')
            ? streamText.indexOf('<response>') + '<response>'.length
            : -1;
        const endResponseIndex = streamText.indexOf('</response>');
        if (endResponseIndex !== -1) {
            setResponseText(streamText.substring(responseIndex, endResponseIndex));
        } else if (responseIndex !== -1) {
            setResponseText(streamText.substring(responseIndex));
        }
    }, [streamText]);

    const formatResponseForMarkdown = (text) => {
        let formattedText = text;
        formattedText = formattedText.replace(/\\\((.+?)\\\)/g, '$$$1$$');
        formattedText = formattedText.replace(
            /\\\[([\s\S]+?)\\\]/g,
            '$$$$\n$1\n$$$$',
        );
        return formattedText.replace(/\[<(\d{1,2})>\]/g, (_, id) => {
            return `<Source id="${id}" />`;
        });
    };

    const Source = ({ id }) => (
        <div
            className="mx-0.5 inline-block h-6 w-6 items-center rounded-xl bg-gray-400 text-center text-sm text-white"
            aria-label="source"
        >
            {id}
        </div>
    );

    return (
        <div>
            {pastStatuses.includes(StreamingStates.Thinking) && (
                <StreamingStatusTag
                    streamState={StreamingStates.Thinking}
                    isCurrentTag={
                        pastStatuses[pastStatuses.length - 1] === StreamingStates.Thinking
                    }
                />
            )}
            <div className="mt-4 rounded-lg bg-gray-100 pl-4">
                <div
                    className="flex w-fit flex-row items-start"
                    style={{
                        padding: '2px',
                        fontFamily: 'Roboto, sans-serif',
                        fontSize: '18px',
                        lineHeight: '1.5',
                        textAlign: 'left',
                        wordWrap: 'break-word',
                        overflowWrap: 'break-word',
                        wordBreak: 'break-word',
                    }}
                >
                    <ReactMarkdown
                        className="markdown mb-0 flex flex-col text-sm"
                        remarkPlugins={[remarkMath, remarkGfm]}
                        rehypePlugins={[rehypeKatex, rehypeRaw]}
                        children={formatResponseForMarkdown(thinkingText || '')}
                        components={{
                            h3: ({ children }) => (
                                <h3 style={{ fontSize: '24px' }}>{children}</h3>
                            ),
                            ul: ({ children }) => (
                                <ul
                                    style={{
                                        fontSize: '16px',
                                        marginTop: '0.5em',
                                        marginBottom: '0.5em',
                                        padding: '5',
                                    }}
                                >
                                    {children}
                                </ul>
                            ),
                            li: ({ children }) => (
                                <li
                                    style={{
                                        marginBottom: '0.2em',
                                        fontSize: '16px',
                                        padding: '0',
                                    }}
                                >
                                    {children}
                                </li>
                            ),
                            code: ({ className, children, ...props }) => (
                                <code
                                    className={className}
                                    style={{
                                        fontSize: '14px',
                                        fontFamily: 'Courier, monospace',
                                        whiteSpace: 'pre-wrap',
                                        wordBreak: 'break-word',
                                    }}
                                    {...props}
                                >
                                    {children}
                                </code>
                            ),
                            p: ({ children, ...props }) => (
                                <p
                                    style={{
                                        margin: '0.1',
                                        padding: '0',
                                        lineHeight: '1.5',
                                    }}
                                    {...props}
                                >
                                    {children}
                                </p>
                            ),
                            source: ({ ...props }) => (
                                <Source id={props.id || 'default-id'} />
                            ),
                        }}
                    />
                </div>
            </div>
            {!hideStreamResponse && responseText !== '' && (
                <div className="mb-2 text-left">
                    <div
                        className="flex w-fit flex-row items-start"
                        style={{
                            padding: '12px',
                            fontFamily: 'Roboto, sans-serif',
                            fontSize: '18px',
                            lineHeight: '1.5',
                            textAlign: 'left',
                            wordWrap: 'break-word',
                            overflowWrap: 'break-word',
                            wordBreak: 'break-word',
                        }}
                    >
                        <ReactMarkdown
                            className="markdown mb-0 flex flex-col"
                            remarkPlugins={[remarkMath, remarkGfm]}
                            rehypePlugins={[rehypeKatex, rehypeRaw]}
                            children={formatResponseForMarkdown(responseText || '')}
                            components={{
                                h3: ({ children }) => (
                                    <h3 style={{ fontSize: '24px' }}>{children}</h3>
                                ),
                                ul: ({ children }) => (
                                    <ul
                                        style={{
                                            fontSize: '16px',
                                            marginTop: '0.5em',
                                            marginBottom: '0.5em',
                                            padding: '5',
                                        }}
                                    >
                                        {children}
                                    </ul>
                                ),
                                li: ({ children }) => (
                                    <li
                                        style={{
                                            marginBottom: '0.2em',
                                            fontSize: '16px',
                                            padding: '0',
                                        }}
                                    >
                                        {children}
                                    </li>
                                ),
                                code: ({ className, children, ...props }) => (
                                    <code
                                        className={className}
                                        style={{
                                            fontSize: '14px',
                                            fontFamily: 'Courier, monospace',
                                            whiteSpace: 'pre-wrap',
                                            wordBreak: 'break-word',
                                        }}
                                        {...props}
                                    >
                                        {children}
                                    </code>
                                ),
                                p: ({ children, ...props }) => (
                                    <p
                                        style={{
                                            margin: '0.1',
                                            padding: '0',
                                            lineHeight: '1.5',
                                        }}
                                        {...props}
                                    >
                                        {children}
                                    </p>
                                ),
                                source: ({ ...props }) => (
                                    <Source id={props.id || 'default-id'} />
                                ),
                            }}
                        />
                    </div>
                </div>
            )}
            {pastStatuses.slice(3).map((status) => (
                <StreamingStatusTag
                    key={status}
                    streamState={status}
                    isCurrentTag={pastStatuses[pastStatuses.length - 1] === status}
                />
            ))}
        </div>
    );
};

export default StreamingComponent;
