/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable react/no-unstable-nested-components */
/* eslint-disable react/no-children-prop */
/* eslint-disable no-lone-blocks */
import 'katex/dist/katex.min.css'; // KaTeX styles

// import Image from 'next/image';
import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useDispatch, useSelector } from 'react-redux';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';

import {
  useCreateMessageMutation,
  useLazyGetMessagesBySessionIdQuery,
} from '@/libs/redux/api/message';
import {
  appendMessage,
  cacheMessages,
} from '@/libs/redux/features/sessionSlice';
import { setUiState } from '@/libs/redux/features/uiSlice';
import type { Conversation, Message, MessageSource } from '@/libs/types/chat';
import { ContentType, MessageRole, MessageStatus } from '@/libs/types/chat';
import { SessionType } from '@/libs/types/sessionType';
import appInsights from '@/monitor/ApplicationInsights';
import { appendJwtToken, checkLogin } from '@/utils/AppendJwtToken';
import { devlog } from '@/utils/logHelper';

import StreamingComponent from './StreamingComponent';
import UserSentMessage from './UserSentMessage'; // Ensure this path is correct
// import { SessionType } from '@/libs/types/sessionType';

interface ChatbotProps {
  setDocumentIndex: (documentIndex: number) => void;
  setSearchText: (searchText: string) => void;
  setPageNumber: (pageNumber: number) => void;
}

const Chatbot: React.FC<ChatbotProps> = ({
  setDocumentIndex,
  setSearchText,
  setPageNumber,
}) => {
  const [getMessages] = useLazyGetMessagesBySessionIdQuery();
  const [createMessage] = useCreateMessageMutation();
  const currentSession = useSelector(
    (state: any) => state.session.currentSession,
  );
  const cachedMessages = useSelector(
    (state: any) => state.session.messages[currentSession?.id || ''] || [],
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState<string>('');
  const dispatch = useDispatch();
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const backendUser = useSelector((state: any) => state.user.backendUser);
  const [loading, setLoading] = useState<boolean>(false);
  const [hideStream, setHideStream] = useState<boolean>(false);
  const [streamEnd, setStreamEnd] = useState<number>(0);
  const [hideStreamResponse, setHideStreamResponse] = useState<boolean>(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [streamText, setStreamText] = useState<string>('');
  const isAutoScrollingRef = useRef(true);
  const [firstQTime, setfirstQTime] = useState<number>(0);
  const [scrolled, setScrolled] = useState<boolean>(false);
  const [isComposing, setIsComposing] = useState(false);

  const handleCompositionStart = () => {
    setIsComposing(true);
  };

  const handleCompositionEnd = () => {
    setIsComposing(false);
  };

  const handleInput = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'; // Reset height
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`; // Set new height
    }
  };
  const currentDocuments = useSelector((state: any) => state.session.documents);

  const currentDocumentStoragePaths = currentSession?.documentIds
    ? currentSession.documentIds.map(
        (docId: string) => currentDocuments[docId]?.storagePath || '',
      )
    : [];

  const checkTime = (message: Message) => {
    // devlog("checkTime");
    if (!message.creationTime) return true;
    const currentTime = Date.now();
    // devlog(currentTime);
    const userMessageTime = new Date(message.creationTime).getTime();
    // devlog(userMessageTime);
    return currentTime - userMessageTime < 600000; // 10 minutes
  };

  const [time, setTime] = useState(new Date());
  // PM19
  const checkScrolling = React.useCallback(() => {
    setScrolled(true);
    window.removeEventListener('scroll', checkScrolling);
  }, []);

  useEffect(() => {
    window.addEventListener('scroll', checkScrolling);
  }, [checkScrolling]);

  useEffect(() => {
    const el = chatContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  useEffect(() => {
    const el = chatContainerRef.current;
    if (!el || !isAutoScrollingRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, streamText]);

  const handleWheel = () => {
    // Access the scroll direction and amount from the event object
    // event: React.WheelEvent
    isAutoScrollingRef.current = false;
  };

  useEffect(() => {
    const intervalId = setInterval(() => {
      setTime(new Date()); // Update time every minute
      // devlog('messages', messages);
      if (
        currentSession &&
        messages.length > 0 &&
        messages[messages.length - 1]!.role === MessageRole.USER &&
        checkTime(messages[messages.length - 1]!)
      ) {
        getMessages(currentSession.id).then((response) => {
          if (response.data) {
            if (response.data.length > messages.length) {
              setMessages(response.data);
            }
          }
        });
      }
      devlog('time', time);
    }, 60000); // 60000 milliseconds = 1 minute
    if (!checkTime) clearInterval(intervalId);
    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  useEffect(() => {
    if (streamEnd > 0) {
      const timeoutId = setTimeout(() => {
        getMessages(currentSession.id).then((response) => {
          if (response.data) {
            if (response.data.length > messages.length) {
              setMessages(response.data);
              setLoading(false);
              setHideStream(true);
              setHideStreamResponse(true);
              // After streaming is complete, create and cache the new messages
              // Cache the tutor's message
              dispatch(
                cacheMessages({
                  sessionId: currentSession.id,
                  messages: response.data,
                }),
              );
            }
          }
        });
      }, 10000);

      return () => clearTimeout(timeoutId);
    }
    return () => {};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamEnd]);

  useEffect(() => {
    devlog('Updated loading:', loading);
  }, [loading]);

  // PM16_1 start of viewing dpc
  useEffect(() => {
    // try to use window listener to capture the user start/end time in the page
    const sessionStart = Date.now();
    // let newFirstQ: number;
    // devlog('ZWY4: when will this trigger: ', Date.now());
    const handleUnload = () => {
      const sessionEnd = Date.now();
      let sessionTime: number = 0;
      let UserQuestionTime: number = 0;
      let reportfirstQ: boolean = false;
      // discussion logic: determine time
      // devlog(
      //   'ZWY2: check firstQTime is valid',
      //   firstQTime,
      //   'or session start',
      //   sessionStart,
      // );
      if (firstQTime === 0) {
        sessionTime = sessionEnd - sessionStart;
      } else if (firstQTime >= sessionStart) {
        // devlog('ZWY3: sessionTime calculation');
        sessionTime = firstQTime - sessionStart;

        UserQuestionTime = sessionEnd - firstQTime;
        reportfirstQ = true;
      }
      // PM16_2
      // devlog('PM16_2a track time viewing summary, ', sessionTime);
      appInsights.trackMetric({
        name: 'UserViewSummary',
        average: sessionTime,
        properties: {
          UserId: '123',
        },
      });
      // PM19_1: track user who did not view summary seriously (10 min==600000 ms)
      if (sessionTime <= 600000 && !scrolled) {
        // devlog('PM19_1: user who did not view summary seriously');
        appInsights.trackMetric({
          name: 'SummaryNotLastOrScroll',
          average: 1,
          properties: {
            UserId: '123',
          },
        });
      }

      // PM16_2
      // devlog('PM16_2b: time user asks first question: ', UserQuestionTime);
      if (reportfirstQ) {
        appInsights.trackMetric({
          name: 'UserViewQ',
          average: UserQuestionTime,
          properties: {
            UserId: '123',
          },
        });
      } else {
        // PM19_2 Drop off before first question:
        // User who uploaded file not did not ask a question
        // devlog('PM19_2: User who uploads file but did not ask a question');
        appInsights.trackMetric({
          name: 'UserNotAskQuestion',
          average: 1,
          properties: {
            UserId: '123',
          },
        });
      }
    };
    window.addEventListener('unload', handleUnload);
    return () => {
      window.removeEventListener('unload', handleUnload);
    };
  }, [firstQTime, scrolled]);
  const stream = async (conversation: Conversation) => {
    devlog('ZWY4: stream');
    setStreamText('');
    setHideStreamResponse(false);
    isAutoScrollingRef.current = true;
    const API_BASE_URL =
      process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080/api';
    const controller = new AbortController();
    const { signal } = controller;
    const fetchData = async () => {
      try {
        let header = new Headers();
        header = await appendJwtToken(header);
        header.append('Content-Type', 'application/json');
        const response = await fetch(`${API_BASE_URL}/chat/subscribe`, {
          method: 'POST',
          headers: header,
          signal,
          body: JSON.stringify(conversation),
        });

        if (!response.body) {
          throw new Error('Response body is null');
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        // eslint-disable-next-line no-constant-condition
        while (true) {
          // eslint-disable-next-line no-await-in-loop
          const { done, value } = await reader.read();
          if (done) break;
          const data = decoder.decode(value);
          // eslint-disable-next-line @typescript-eslint/no-loop-func
          data.split('\n\n').forEach((event) => {
            if (!event.startsWith('data:')) return;

            const jsonStr = event.slice(5);
            try {
              const parsed = JSON.parse(jsonStr);
              const output = parsed.msg_content;
              if (output && output.length > 0) {
                setStreamText((prevText) => prevText + output);
              }
            } catch (error) {
              devlog('parse SSE data:', error, data);
            }
          });
        }

        setStreamEnd(streamEnd + 1);
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('Fetch error:', error);
        }
      }
    };

    fetchData();
    return () => controller.abort();
  };

  const handleSendMessage = async (tempInput?: string) => {
    if (!(await checkLogin())) {
      dispatch(setUiState('signIn'));
      return;
    }
    let currentInput = input;
    if (tempInput) {
      currentInput = tempInput;
    } else {
      appInsights.trackEvent({
        name: 'User asked a custom question',
        properties: { input, currentSession },
      });
    }
    if (currentInput.trim() === '') return;
    if (firstQTime === 0) {
      setfirstQTime(Date.now());
    }
    const userSubMessage = {
      text: currentInput,
      image: null,
      audio: null,
      contentType: ContentType.TEXT,
      creationTime: null,
      sources: [],
    };
    let userMessage: Message = {
      sessionId: currentSession.id,
      id: null,
      parentMessageId: null,
      userId: backendUser.id,
      subMessages: [userSubMessage],
      creationTime: null,
      lastUpdatedTime: null,
      status: MessageStatus.UNVIEW,
      role: MessageRole.USER,
      followUpQuestions: [],
    };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setLoading(true);
    const userId = backendUser?.id;
    if (!currentSession) {
      console.error('Error: session is undefined');
      return;
    }
    try {
      appInsights.trackEvent({
        name: 'Submitted question',
        properties: { userMessage },
      });
      createMessage(userMessage)
        .unwrap()
        .then((response) => {
          if (response) {
            userMessage = response;
            // Cache the new message
            dispatch(
              appendMessage({
                sessionId: currentSession.id,
                message: userMessage,
              }),
            );
            setInput('');
            handleInput();
          }
        });
      if (tempInput !== undefined) {
        devlog('PM10 is triggered!!! ');
        appInsights.trackMetric({
          name: 'UserAIAskQuestion',
          average: 1,
          properties: {
            UserId: userId,
            CurTime: new Date().toISOString(),
          },
        });
      } else {
        appInsights.trackMetric({
          name: 'UserManualAskQuestion',
          average: 1,
          properties: {
            UserId: userId,
            CurTime: new Date().toISOString(),
          },
        });
      }
    } catch (error) {
      console.error('Error creating message:', error);
    }

    const sessionId = currentSession.id;
    const currentConversation: Conversation = {
      userId,
      sessionId,
      ragSessionId: null,
      history: messages,
      message: userMessage,
      storagePaths: currentDocumentStoragePaths,
      type: currentSession.type,
      streaming: true,
    };
    try {
      setHideStream(false);
      await stream(currentConversation);
    } catch (error) {
      console.error('Error fetching bot response:', error);
    }
  };

  const getHideStreamButtonText = () => {
    if (hideStream) {
      return 'Show thinking process';
    }

    return 'Hide thinking process';
  };

  useEffect(() => {
    devlog('Current Session:', currentSession);
    devlog('Current user:', backendUser);
    if (currentSession) {
      // First check if we have cached messages
      if (cachedMessages.length > 0) {
        setMessages(cachedMessages);
      } else {
        // If no cached messages, fetch from API
        getMessages(currentSession.id).then((response) => {
          if (response.data) {
            setMessages(response.data);
            // Cache the fetched messages
            dispatch(
              cacheMessages({
                sessionId: currentSession.id,
                messages: response.data,
              }),
            );
            if (response.data.length === 0) {
              handleSendMessage(
                'Based on the context provided, make a summary for the document. Begin with "Summary"',
              );
            }
          }
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatResponseForMarkdown = (text: string): string => {
    let formattedText = text;
    // devlog(text);

    // Replace inline math-like expressions (e.g., \( u \)) with proper Markdown math
    formattedText = formattedText.replace(/\\\((.+?)\\\)/g, '$$$1$$');

    // Replace block math-like expressions (e.g., \[ ... \]) with proper Markdown math
    formattedText = formattedText.replace(
      /\\\[([\s\S]+?)\\\]/g,
      '$$$$\n$1\n$$$$',
    );
    // // Remove excessive blank lines by collapsing multiple newlines into one
    // formattedText = formattedText.replace(/\n{2,}/g, '\n');

    // // Ensure there's only one newline before headers or list items
    // formattedText = formattedText.replace(/(\n+)(#+|\s*[-*])/g, '\n$2');
    // /* devlog(
    //   'formattedText:',
    //   formattedText.trim().replace(/\n\s*\n/g, '\n'),
    // ); */
    return formattedText.replace(/\[<(\d{1,2})>\]/g, (_, id) => {
      return `<Source id="${id}" />`;
    }); // .trim().replace(/\n\s*\n/g, '\n');
  };

  const handleJumpToSource = (source: MessageSource): void => {
    // console.log('ZWY4: source', source);
    appInsights.trackEvent({
      name: 'User clicked source',
      properties: { source, messages },
    });
    // PM11_1: user check highlight source
    // devlog('PM11_1: User check highlight source', new Date().toISOString());
    appInsights.trackMetric({
      name: 'UserClickSource',
      average: 1,
      properties: {
        UserId: backendUser.id, // need to get UserId
        Curtime: new Date().toISOString(),
      },
    });
    setDocumentIndex(source.refinedIndex);
    setPageNumber(source.page);
    setSearchText(source.referenceString);
  };

  const handleClickedFollowUpQuestions = (question: string): void => {
    appInsights.trackEvent({
      name: 'User clicked suggested question',
      properties: { question, messages },
    });
    handleSendMessage(question);
  };

  const Source = ({ id, source }: { id: string; source: MessageSource }) => (
    <button
      type="button"
      onClick={() => handleJumpToSource(source)}
      // eslint-disable-next-line react/no-array-index-key
      className="mx-0.5 h-6 w-6 items-center rounded-xl bg-blue-300 text-center text-sm text-white hover:bg-blue-700 "
      aria-label="source"
    >
      {id}
    </button>
  );

  const getPlaceholderText = () => {
    if (loading) {
      return 'Loading tutor response...';
    }
    if (currentSession.type === SessionType.LITE) {
      return 'Message DeepTutor Lite';
    }
    if (currentSession.type === SessionType.BASIC) {
      return 'Message DeepTutor Standard';
    }
    if (currentSession.type === SessionType.ADVANCED) {
      return 'Message DeepTutor Advanced';
    }
    return 'Message DeepTutor';
  };

  return (
    <div
      className="flex h-auto max-h-[100vh] flex-1"
      style={{ minWidth: 0 }} // Added to allow shrinking with flex-1
    >
      <div className="flex h-full w-full flex-col items-center bg-white pr-0">
        <div className="flex h-full w-full flex-col overflow-auto bg-white">
          <div
            onWheel={handleWheel}
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto p-2"
            style={{
              scrollbarWidth: 'thin',
              scrollbarColor: '#D9D9D9 rgba(0,0,0,0.4)',
            }}
          >
            <style>
              {`
                .flex-1::-webkit-scrollbar {
                  width: 8px;
                }
                .flex-1::-webkit-scrollbar-thumb {
                  background-color: rgba(217, 217, 217, 0.4);
                  border-radius: 10px;
                }
                .flex-1::-webkit-scrollbar-track {
                  background: transparent;
                }
              `}
            </style>
            {messages.map((message, index) => {
              // console.log('ZWY4: message', message);
              const isLatestMessage = index === messages.length - 1;
              return (
                // streaming components first
                <div key={message.id || index}>
                  {isLatestMessage &&
                    message.role === MessageRole.TUTOR &&
                    streamText !== '' && (
                      <button
                        type="button"
                        onClick={() => setHideStream(!hideStream)}
                        className="mt-4 flex flex-row gap-1 rounded-md border-4 px-4 py-2"
                      >
                        {getHideStreamButtonText()}
                        {hideStream && (
                          <svg
                            width="18"
                            height="22"
                            viewBox="0 0 18 22"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <g id="iconamoon:arrow-down-2">
                              <path
                                id="Vector"
                                d="m7 15l5 5m0 0l5-5"
                                stroke="#AFAFAF"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </g>
                          </svg>
                        )}
                        {!hideStream && (
                          <svg
                            width="18"
                            height="22"
                            viewBox="0 0 18 22"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <g id="iconamoon:arrow-down-2">
                              <path
                                id="Vector"
                                d="m7 18l5-5m0 0l5 5"
                                stroke="#AFAFAF"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </g>
                          </svg>
                        )}
                      </button>
                    )}
                  {isLatestMessage &&
                    message.role === MessageRole.TUTOR &&
                    !hideStream &&
                    streamText !== '' && (
                      <StreamingComponent
                        streamText={streamText}
                        hideStreamResponse={hideStreamResponse}
                      />
                    )}
                  {index >= 1 && (
                    // eslint-disable-next-line react/no-array-index-key
                    <div key={index}>
                      {message.subMessages.map(
                        (subMessage, subIndex) =>
                          subMessage.contentType !== ContentType.THINK && (
                            <div
                              // eslint-disable-next-line react/no-array-index-key
                              key={subIndex}
                              className="mb-2 text-left"
                            >
                              <div
                                className={`flex w-fit flex-row  ${
                                  message.role === MessageRole.USER
                                    ? ' items-center rounded-lg border-2 border-blue-300'
                                    : 'items-start'
                                }`}
                                style={{
                                  padding: '12px',
                                  fontFamily: 'Roboto, sans-serif',
                                  // fontWeight: 400,
                                  fontSize: '18px',
                                  lineHeight: '1.5',
                                  textAlign: 'left',
                                  wordWrap: 'break-word', // Ensures long words break to fit within the box
                                  overflowWrap: 'break-word', // Prevents text overflow
                                  wordBreak: 'break-word',
                                }}
                              >
                                {message.role === MessageRole.USER && (
                                  <UserSentMessage />
                                )}

                                <ReactMarkdown
                                  className="markdown mb-0 flex flex-col"
                                  remarkPlugins={[remarkMath, remarkGfm]}
                                  rehypePlugins={[rehypeKatex, rehypeRaw]}
                                  // children={'$$l = r\theta$$'}
                                  // children={subMessage.text || ''}
                                  children={formatResponseForMarkdown(
                                    subMessage.text || '',
                                  )}
                                  components={{
                                    h3: ({ children }) => (
                                      <h3
                                        style={{
                                          fontSize: '24px',
                                        }}
                                      >
                                        {children}
                                      </h3>
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
                                    code: ({
                                      className,
                                      children,
                                      ...props
                                    }) => (
                                      <code
                                        className={className}
                                        style={{
                                          fontSize: '14px', // Reduced font size for code
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
                                          // whiteSpace: 'pre-wrap', // Ensures text wraps properly
                                          // wordBreak: 'break-word', // Prevents words from breaking container bounds
                                          margin: '0.1', // Removes extra margin
                                          padding: '0', // Removes extra padding
                                          lineHeight: '1.5', // Adjusts line height for readability
                                        }}
                                        {...props} // Pass remaining props dynamically
                                      >
                                        {children}
                                      </p>
                                    ),
                                    source: ({ ...props }) => (
                                      <Source
                                        id={props.id || 'default-id'}
                                        source={
                                          subMessage.sources[
                                            Number(props.id) - 1
                                          ] ?? {
                                            index: 0,
                                            referenceString: '',
                                            page: 0,
                                            refinedIndex: 0,
                                            sourceAnnotation: {
                                              pageNum: 0,
                                              startChar: 0,
                                              endChar: 0,
                                              success: false,
                                              similarity: 0,
                                            },
                                          }
                                        }
                                      />
                                    ),
                                  }}
                                />
                                <style>
                                  {`
                            .katex {
                              font-size: 17px !important; /* Inline math font size */
                              line-height: 1.2 !important;
                              word-wrap: break-word !important;
                            }
                            .katex-display {
                              font-size: 16px !important; /* Block math font size */
                              line-height: 1.2 !important;
                              word-wrap: break-word !important;
                              text-align: left !important; /* Align block math */
                            }
                          `}
                                </style>
                              </div>
                            </div>
                          ),
                      )}
                    </div>
                  )}

                  {isLatestMessage &&
                    message.followUpQuestions &&
                    message.followUpQuestions.length > 0 && (
                      <div className="mb-3 mt-4 pl-2">
                        <h3 className="text-lg font-bold text-black">
                          Follow Up Questions:
                        </h3>
                      </div>
                    )}
                  {isLatestMessage &&
                    message.followUpQuestions &&
                    message.followUpQuestions.map(
                      (question: string, questionIndex: number) => (
                        // eslint-disable-next-line react/no-array-index-key
                        <div key={questionIndex}>
                          <button
                            type="button"
                            aria-label="Show Mind Map button"
                            className="mb-3 inline-flex items-center justify-center gap-3 rounded-lg border border-button-border-gray bg-transparent p-2 text-left font-roboto font-bold text-text-deep-black transition-all duration-300 hover:bg-blue-400 hover:text-white xxs:px-3 xs:px-4 md:px-5 tablet:px-6"
                            onClick={() =>
                              handleClickedFollowUpQuestions(question)
                            }
                          >
                            {question}
                          </button>
                        </div>
                      ),
                    )}
                  {isLatestMessage &&
                    message.role === MessageRole.USER &&
                    !hideStream && (
                      <StreamingComponent
                        streamText={streamText}
                        hideStreamResponse={hideStreamResponse}
                      />
                    )}
                </div>
              );
            })}
          </div>
          <div className="flex w-full flex-row items-end overflow-y-auto bg-[#000000] bg-opacity-[0.05] py-1 pl-2">
            <textarea
              ref={textareaRef}
              value={input}
              rows={1} // Default to 1 line
              className="my-3 flex max-h-[30vh] w-full resize-none overflow-y-auto border-none bg-transparent px-4 outline-none"
              onInput={handleInput}
              placeholder={getPlaceholderText()}
              readOnly={loading}
              onChange={(e) => setInput(e.target.value)}
              onCompositionStart={handleCompositionStart}
              onCompositionEnd={handleCompositionEnd}
              onKeyDown={(e) => {
                if (
                  e.key === 'Enter' &&
                  !e.shiftKey &&
                  !e.ctrlKey &&
                  !e.altKey &&
                  !e.metaKey &&
                  !isComposing
                )
                  handleSendMessage();
              }}
              style={{
                fontFamily: 'Roboto, sans-serif',
                fontWeight: 400,
                fontSize: '20px',
                resize: 'none',
                scrollbarWidth: 'thin',
                scrollbarColor: '#D9D9D9 rgba(0,0,0,0.4)',
              }}
            >
              <style>
                {`
                .flex-1::-webkit-scrollbar {
                  width: 8px;
                }
                .flex-1::-webkit-scrollbar-thumb {
                  background-color: rgba(217, 217, 217, 0.4);
                  border-radius: 10px;
                }
                .flex-1::-webkit-scrollbar-track {
                  background: transparent;
                }
              `}
              </style>
            </textarea>

            <button
              type="button"
              onClick={() => handleSendMessage()}
              className="p-4 text-blue-500 hover:text-blue-700"
              aria-label="Send message"
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 22 22"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M21.1996 0.549377C20.9639 0.313669 20.6697 0.14503 20.3472 0.0608259C20.0248 -0.0233778 19.6857 -0.0201025 19.3649 0.0703145L19.3443 0.076877L1.35269 5.53125C0.987805 5.63709 0.663677 5.85127 0.423239 6.14544C0.182802 6.43961 0.0374012 6.79987 0.00629592 7.17853C-0.0248094 7.55718 0.0598483 7.93634 0.249056 8.26581C0.438264 8.59527 0.723094 8.85948 1.06582 9.02344L8.90519 12.8438L12.7218 20.6859C12.8723 21.006 13.111 21.2764 13.41 21.4654C13.7089 21.6544 14.0556 21.7541 14.4093 21.7528C14.4627 21.7528 14.5171 21.7528 14.5714 21.7463C14.9511 21.717 15.3126 21.5719 15.6071 21.3304C15.9015 21.0889 16.1147 20.7628 16.2177 20.3963L21.6721 2.40469C21.6748 2.398 21.677 2.39111 21.6786 2.38406C21.769 2.06327 21.7723 1.72418 21.6881 1.4017C21.6039 1.07922 21.4353 0.785013 21.1996 0.549377ZM14.3343 18.8503L11.1121 12.2278L15.4246 7.92C15.5292 7.81536 15.6122 7.69112 15.6689 7.55439C15.7255 7.41767 15.7546 7.27112 15.7546 7.12313C15.7546 6.97513 15.7255 6.82859 15.6689 6.69186C15.6122 6.55513 15.5292 6.4309 15.4246 6.32625C15.3199 6.22161 15.1957 6.13859 15.059 6.08196C14.9222 6.02533 14.7757 5.99618 14.6277 5.99618C14.4797 5.99618 14.3332 6.02533 14.1964 6.08196C14.0597 6.13859 13.9355 6.22161 13.8308 6.32625L9.51832 10.6388L2.89863 7.41469L19.3114 2.4375L14.3343 18.8503Z"
                  fill="#0687E5"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chatbot;
