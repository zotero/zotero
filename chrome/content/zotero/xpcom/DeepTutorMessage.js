Zotero.Message = class {
    constructor({ 
        id = null, 
        parentMessageId = null, 
        userId = null, 
        sessionId = null, 
        subMessages = [], 
        followUpQuestions = [], 
        creationTime = new Date().toISOString(), 
        lastUpdatedTime = new Date().toISOString(), 
        status = 'active', 
        role = 'user' 
    } = {}) {
        this.id = id;
        this.parentMessageId = parentMessageId;
        this.userId = userId;
        this.sessionId = sessionId;
        this.subMessages = subMessages;
        this.followUpQuestions = followUpQuestions;
        this.creationTime = creationTime;
        this.lastUpdatedTime = lastUpdatedTime;
        this.status = status;
        this.role = role;
    }
}