/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2024 Corporation for Digital Scholarship
                     Vienna, Virginia, USA
                     https://www.zotero.org
    
    This file is part of Zotero.
    
    Zotero is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.
    
    Zotero is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.
    
    You should have received a copy of the GNU Affero General Public License
    along with Zotero.  If not, see <http://www.gnu.org/licenses/>.
    
    ***** END LICENSE BLOCK *****
*/

var EXPORTED_SYMBOLS = ["Session"];

const Session = {
    create: function({
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
        let session = {
            id: id,
            userId: userId,
            sessionName: sessionName,
            creationTime: creationTime,
            lastUpdatedTime: lastUpdatedTime,
            type: type,
            status: status,
            statusTimeline: statusTimeline,
            documentIds: documentIds,
            generateHash: generateHash
        };

        session.update = function() {
            this.lastUpdatedTime = new Date().toISOString();
        };

        session.toJSON = function() {
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
        };

        return session;
    }
}; 