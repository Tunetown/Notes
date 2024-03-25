/**
 * Importer for JSON trello data.
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
class TrelloImporter {
	
	#app = null;
	
	constructor(app) {
		this.#app = app;
	}
	
	/**
	 * Initialize the importer (add options etc)
	 */
	initialize() {
		$('#importOptionsContainer').append(
			$('<table class="importOptionsTable"></table>').append(
				$('<tbody></tbody>').append(
					$('<tr></tr>').append(
						$('<td>Import Background Image</td>'),
						$('<td></td>').append(
							$('<input type="checkbox" id="importBackground" checked />')	
						)
					),
					$('<tr></tr>').append(
						$('<td>Import Attachments</td>'),
						$('<td></td>').append(
							$('<input type="checkbox" id="importAttachments" checked />')	
						)
					),
					$('<tr></tr>').append(
						$('<td>Import Comments</td>'),
						$('<td></td>').append(
							$('<input type="checkbox" id="importComments" checked />')	
						)
					),
					$('<tr></tr>').append(
						$('<td>Import Labels</td>'),
						$('<td></td>').append(
							$('<input type="checkbox" id="importLabels" checked />')	
						)
					)
				)
			)
		);
	}
	
	/**
	 * Returns an options array.
	 */
	parseOptions() {
		return {
			importBackgroundImage: !!$('#importBackground').is(':checked'),
			importAttachments: !!$('#importAttachments').is(':checked'),
			importComments: !!$('#importComments').is(':checked'),
			importLabels: !!$('#importLabels').is(':checked'),
		};
	}
	
	/**
	 * Import the passed string data as Trello JSON board data.
	 */
	async process(jsonString, sourceName) {
		var options = this.parseOptions();
		
		if (!jsonString) {
			return Promise.reject({
				message: 'No data to import',
				messageThreadId: 'ImportProcessMessages'
			});
		}
		if (!sourceName) {
			return Promise.reject({
				message: 'No root item name to import to',
				messageThreadId: 'ImportProcessMessages'
			});
		}
		
		var d = this.#app.data;
		
		// Parse data
		var data = JSON.parse(jsonString);
		
		if (data.lists) {
			data.lists.sort(function(a, b) { return a.pos - b.pos; })
		}
		if (data.cards) {
			data.cards.sort(function(a, b) { return a.pos - b.pos; })
		}
		
		var name = data.name ? data.name : sourceName;
		var rootId = d.generateIdFrom(name);
		var docs = [];
		//var that = this;
		var attachmentsSize = 0;
		
		// BG Image
		var bgDoc = null;
		if (options.importBackgroundImage && data.prefs && data.prefs.backgroundImage) {
			var resp = await this.fetchAttachment(data.prefs.backgroundImage, 'Board Background Image', rootId);
			if (resp.doc) {
				bgDoc = resp.doc;
				bgDoc.content_type = 'image/jpeg';
				
				attachmentsSize += resp.size;
			}
		}
		var order = 1;
		
		// Root item
		var root = {
			_id: rootId,
			name: name,
			type: 'note',
			parent: '',
			content: '',
			board: true,
			//boardBackground: bgDoc ? bgDoc._id : false,   // TODO deprecated! Implement this again with attachment background. 
			timestamp: Date.now(),
		};
		
		if (bgDoc) docs.push(bgDoc);
		
		// Labels
		if (options.importLabels) {
			for(var l in data.labels || []) {
				var label = data.labels[l];
				if (!label.id) continue;
				
				Document.addLabelDefinition(
					root, 
					label.name ? label.name : (label.color ? label.color : 'Unnamed label'), 
					label.color ? label.color : '#555555', 
					label.id,
				);
			}
		}
		
		docs.push(root);
		
		// Lists / Cards
		var listCnt = 0;
		var cardCnt = 0;
		for(var l in data.lists || []) {
			listCnt++;
			var list = data.lists[l];
			if (list.closed) continue;
			
			// List
			var listName = list.name ? list.name : ('List ' + listCnt);  
			var columnDoc = {
				_id: d.generateIdFrom(listName),
				name: listName,
				type: 'note',
				parent: root._id,
				content: '',
				order: order++,
				timestamp: Date.now(),
			};
			docs.push(columnDoc);
			
			// Cards
			for(var c in data.cards || []) {
				var card = data.cards[c];
				
				if (card.closed) continue;
				if (card.idList != list.id) continue;
				
				cardCnt++;

				var cardName = card.name ? card.name : ('Card ' + cardCnt);  
				var cardId = d.generateIdFrom(cardName);
				var cardContent = card.desc ? this.decodeMarkdown(card.desc) : ''; 
				
				// Comments
				if (options.importComments) {
					for(var a in data.actions || []) {
						var act = data.actions[a];
						if (!act.data || !act.data.card || (act.data.card.id != card.id)) continue;
						if (act.type != 'commentCard') continue;
						
						console.log('  -> Appending comment to ' + cardName);
						cardContent += '<hr>Comment at ' + act.date + ' by ' + act.memberCreator.fullName + ': <br>' + this.decodeMarkdown(act.data.text);
					}
				}
				
				var cardDoc = {
					_id: cardId,
					name: cardName,
					type: 'note',
					parent: columnDoc._id,
					content: cardContent,
					timestamp: Date.now(),
					order: order++,
					labels: options.importLabels ? card.idLabels : false,
				};
				docs.push(cardDoc);
				
				// Attachments
				if (options.importAttachments) {
					for(var a in card.attachments || []) {
						var att = card.attachments[a];
						
						if (att.isUpload) {
							var resp = await this.fetchAttachment(att.url, att.fileName, cardId);
							if (resp.doc) {
								var attDoc = resp.doc; 
								docs.push(attDoc);
								
								attachmentsSize += resp.size;
							}
						} else {
							console.log('  -> Appending attached link to ' + cardName + ': ' + att.url);
							cardContent += '<hr>Attached Link: <a href="' + att.url + '" target="_blank">' + att.url + '</a>';
						}
					}
				}
			}
		}
		
		console.log(' -> Lists to import: ' + listCnt, 'I');
		console.log(' -> Cards to import: ' + cardCnt, 'I');

		if (!confirm('Do you want to import ' + cardCnt + ' cards holding ' + Tools.convertFilesize(JSON.stringify(docs).length + attachmentsSize) + ' of data?')) {
			return Promise.reject({
				message: 'Import cancelled',
				messageThreadId: 'ImportProcessMessages',
				abort: true
			});
		}
		
		return NotesImporter.importDocuments(this.#app, docs)
		.then(function(data) {
			if (!data.ok) {
				console.log('Error in Trello import: ' + data.message, 'E');
				return Promise.reject(data);
			}
			
			console.log('Finished Trello import.', 'S');
			return Promise.resolve({
				message: 'Finished Trello import.',
				messageThreadId: 'ImportProcessMessages',
				ok: true,
				listCnt: listCnt,
				cardCnt: cardCnt,
			});
		});
	}
	
	/**
	 * Use showdown to convert the markdown text to html
	 */
	decodeMarkdown(md) {
		var converter = new showdown.Converter({
			prefixHeaderId: 'TrelloImport_',
			strikethrough: true,
			emoji: true
		});
		converter.setFlavor('github');
		
	    return converter.makeHtml(md);
	}
	
	/**
	 * Synchronously fetches an attachment and returns an attachment document for it.
	 */
	async fetchAttachment(url, fileName, parentId) {
		console.log(" -> Fetching " + url);
		var doc = null;
		var size = 0;
		
		var that = this;
		await fetch(url, {
			mode: 'no-cors'
		})
		.then(function(response) { 
			return response.blob(); 
		})
		.then(function(resp) {
			if (!resp.size) {
				console.log(' -> No or invalid data received:');
				return Promise.reject({
					message: 'Error fetching attachment',
					messageThreadId: 'ImportProcessMessages'
				});
			}
			console.log(" -> Received " + Tools.convertFilesize(resp.size) + ', type: ' + resp.type);

			var name = resp.name ? resp.name : fileName;
			var strippedName = Document.stripAttachmentName(fileName);
			doc = {
				_id: that.#app.data.generateIdFrom(name),
				type: "attachment",
				name: name,
				parent: parentId,
				timestamp: resp.lastModified ? resp.lastModified : Date.now(),
				content_type: resp.type,
				attachment_filename: strippedName,
				_attachments: {}
			};
		    
			doc._attachments['attachment_data'] = {
				content_type: resp.type,
    			data: resp
			};
			
			size = resp.size;
		})
		.catch(function(err) {
			that.#app.errorHandler.handle(err);
		});
		
		return {
			doc: doc,
			size: size
		};
	}
}