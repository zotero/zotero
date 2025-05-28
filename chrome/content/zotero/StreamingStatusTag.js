const StreamingStates = {
    Default: 0,
    Id: 1,
    Thinking: 2,
    Response: 3,
    Sources: 4,
    SourcePage: 5,
    FollowUpQuestions: 6,
    Appendix: 7
};

const getLoadingText = (currentStatus) => {
    switch (currentStatus) {
        case StreamingStates.Thinking:
            return 'Thinking ...';
        case StreamingStates.Response:
            return 'Outputting response ...';
        case StreamingStates.Sources:
            return 'Finding sources ...';
        case StreamingStates.SourcePage:
            return 'Finding source page numbers ...';
        case StreamingStates.FollowUpQuestions:
            return 'Generating follow-up questions ...';
        case StreamingStates.Appendix:
            return 'Formatting response ...';
        default:
            return 'Generating ...';
    }
};

const StreamingStatusTag = ({ streamState, isCurrentTag }) => {
    return (
        <div>
            {!isCurrentTag && (
                <div className="my-4 flex w-fit gap-1 rounded-md border-4 px-4 py-2">
                    <div className="flex items-center justify-center">
                        <svg
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <path
                                d="M5 12l5 5L20 7"
                                stroke="green"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    </div>
                    {getLoadingText(streamState)}
                </div>
            )}
            {isCurrentTag && (
                <div className="my-4 flex w-fit gap-1 rounded-md border-4 px-4 py-2">
                    <div className="flex items-center justify-center">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                    </div>
                    {getLoadingText(streamState)}
                </div>
            )}
        </div>
    );
};

export { StreamingStates, StreamingStatusTag };
