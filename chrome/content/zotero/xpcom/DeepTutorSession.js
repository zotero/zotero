class Session {
    constructor({
        id = 123,
        userId = 1234,
        sessionName = new Date().toISOString(),
        creationTime = new Date().toISOString(),
        lastUpdatedTime = new Date().toISOString(),
        type = 'default',
        status = 'active',
        statusTimeline = [],
        documentIds = [],
        generateHash = false
    } = {}) {
        this.id = id;
        this.userId = userId;
        this.sessionName = sessionName;
        this.creationTime = creationTime;
        this.lastUpdatedTime = lastUpdatedTime;
        this.type = type;
        this.status = status;
        this.statusTimeline = statusTimeline;
        this.documentIds = documentIds;
        this.generateHash = generateHash;
    }

    update() {
        this.lastUpdatedTime = new Date().toISOString();
    }

    toJSON() {
        return {
            id: this.id,
            userId: this.userId,
            sessionName: this.sessionName,
            creationTime: this.creationTime,
            lastUpdatedTime: this.lastUpdatedTime,
            type: this.type,
            status: this.status,
            statusTimeline: this.statusTimeline,
            documentIds: this.documentIds
        };
    }
}

// Export the Session class
var EXPORTED_SYMBOLS = ['Session'];