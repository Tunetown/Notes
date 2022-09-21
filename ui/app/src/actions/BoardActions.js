/**
 * Actions for board mode.
 * 
 * (C) Thomas Weber 2021 tom-vibrant@gmx.de
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
class BoardActions {
	
	/**
	 * Singleton factory
	 */
	static getInstance() {
		if (!BoardActions.instance) BoardActions.instance = new BoardActions();
		return BoardActions.instance;
	}
	
	/**
	 * Saves the note's board state to the server.
	 */
	saveBoardState(id, state) {
		if (!id) return Promise.reject({ 
			message: 'No ID passed',
			messageThreadId: 'SaveBoardStateMessages' 
		});
			
		var n = Notes.getInstance();
		
		var doc = n.getData().getById(id);
		if (!doc) return Promise.reject({
			message: 'Document ' + id + ' not found',
			messageThreadId: 'SaveBoardStateMessages' 
		});

		return DocumentAccess.getInstance().loadDocuments([doc])
		.then(function(/*resp*/) {
			doc.boardState = state;
			
			return DocumentAccess.getInstance().saveItem(id);
		})
		.then(function(dataResp) {
			if (!dataResp.abort) {
				// Execute callbacks
				Callbacks.getInstance().executeCallbacks('saveBoardState', doc);
				
				console.log("Successfully saved state of " + doc.name);
				
				return Promise.resolve({ 
					ok: true,
					message: "Successfully saved state of " + doc.name + ".",
					messageThreadId: 'SaveBoardStateMessages' 
				});
			} else {
				return Promise.resolve(dataResp);
			}
		});
	}
	
	/**
	 * Loads and returns the board background for the passed document (which should be, but must not be a board).
	 */
	getBoardBackground(id) {
		if (!id) return Promise.reject({ 
			message: 'No ID passed',
			messageThreadId: 'GetBoardBackgroundMessages'
		});
		
		var doc = Notes.getInstance().getData().getById(id);
		if (!doc) return Promise.reject({
			message: 'Document ' + id + ' does not exist',
			messageThreadId: 'GetBoardBackgroundMessages'
		});
		
		return Database.getInstance().get()
		.then(function(db) {
			return db.getAttachment(id, 'board_background');
		})
		.then(function(attBlob) {
			return new Promise(function(resolve, reject) {
				var reader = new FileReader();
				reader.onload = function() {
					resolve(reader.result);
				}
				
				reader.readAsText(attBlob);
			});
		})
		.then(function(imageData) {
			return Promise.resolve(JSON.parse(imageData));
		});
	}
	
	/**
	 * Sets a new board background image for the given document
	 */
	setBoardBackgroundImage(id) {
		if (!id) return Promise.reject({ 
			message: 'No ID passed',
			messageThreadId: 'SaveBoardBgImageMessages' 
		});
		
		var n = Notes.getInstance();
		
		var doc = n.getData().getById(id);
		if (!doc) return Promise.reject({
			message: 'Document ' + id + ' not found',
			messageThreadId: 'SaveBoardBgImageMessages' 
		});
		
		var that = this;
		return this.getBoardBackground(doc._id)
		.then(function(imageData) {
			doc = Notes.getInstance().getData().getById(doc._id);  // Reload doc 
			
			return ImageDialog.getInstance().askForImage(
				doc,
				doc.name,
				imageData,
				Config.BOARD_BACKGROUND_MAX_WIDTH, 
				Config.BOARD_BACKGROUND_MAX_HEIGHT, 
				Config.BOARD_BACKGROUND_MIME_TYPE,
				Config.BOARD_BACKGROUND_QUALITY,
				Config.BOARD_BACKGROUND_DONT_RESCALE_BELOW_BYTES
			);
		}) 
		.catch(function(err) {
			if (err && err.abort) {
				return Promise.reject(err);
			} 
			
			return ImageDialog.getInstance().askForImage(
				doc,
				doc.name,
				false,
				Config.BOARD_BACKGROUND_MAX_WIDTH, 
				Config.BOARD_BACKGROUND_MAX_HEIGHT, 
				Config.BOARD_BACKGROUND_MIME_TYPE,
				Config.BOARD_BACKGROUND_QUALITY,
				Config.BOARD_BACKGROUND_DONT_RESCALE_BELOW_BYTES
			);
		})
		.then(function(backImage) {
			return that.saveBoardBackgroundImage(id, backImage);
		})			        	
		.then(function(/*data*/) {
			return Promise.resolve({
				ok: true,
				message: 'Updated background image for ' + doc.name,
				messageThreadId: 'SetBoardBgImageMessages'
			});
    	})
	}
	
	
	/**
	 * Saves the passed image data to the passed document as board background.
	 */
	saveBoardBackgroundImage(id, imageData) {
		var n = Notes.getInstance();

		var doc = n.getData().getById(id);
		if (!doc) return Promise.reject({
			message: 'Document ' + id + ' not found',
			messageThreadId: 'SaveBoardBgImageMessages' 
		});
		
    	return DocumentAccess.getInstance().loadDocuments([doc])
    	.then(function(/*resp*/) {
			var blobData =  new Blob([JSON.stringify(imageData)], {
			    type: 'application/json'
			});
			if (!doc._attachments) {
				doc._attachments = {};
			}
			doc._attachments['board_background'] = {
				content_type: 'application/json',
    			data: blobData,
				length: blobData.size
			};
								    
			// Change log entry
			Document.addChangeLogEntry(doc, 'boardBackImageChanged', { 
				bytes: blobData.size
			});
			
	    	// Save the new tree structure by updating the metadata of all touched objects.
	    	return DocumentAccess.getInstance().saveItems([id]);
		})
    	.then(function(/*data*/) {
    		// Execute callbacks
    		Callbacks.getInstance().executeCallbacks('setBoardBackgroundImage', doc);
    		
    		return Promise.resolve({ ok: true });
    	});
	}
	
}