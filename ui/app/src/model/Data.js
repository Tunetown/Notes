/**
 * Data container for Notes App
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

class Data {
	
	#app = null;
	
	#linkedPathElementClass = "linkedPathElement";
	#linkedPathElementSeparatorClass = "linkedPathElementSeparator";
	
	/**
	 * Create instance with a bulk data array (as received from a 
	 * getAll request to PouchDB as the rows array).
	 */
	constructor(app, bulkData, nestedDocPropName) {
		this.#app = app;
		
		this.#prepareData(bulkData, nestedDocPropName);
		
	}
	
	/**
	 * Adds missing values to all documents, and create a keyed map from them
	 * for fast access.
	 */
	#prepareData(bulkData, nestedDocPropName) {
		this.data = new Map();
		
		for (var i in bulkData) {
			var doc;
			if (nestedDocPropName) {
				if (!bulkData[i].hasOwnProperty(nestedDocPropName)) {
					throw new Error('INTERNAL ERROR: Invalid nested property name: ' + nestedDocPropName);
				}
				doc = bulkData[i][nestedDocPropName];
			} else {
				doc = bulkData[i];
			}
			
			// Filter out invalid documents
			if (!doc.type) continue;
			if (doc._id == doc.parent) {
				console.log(' -> Filtered document with self-parent: ' + doc._id);
				continue;
			}

			// Filter out deleted documents
			if (doc._deleted) continue;
			
			// Set name if not present
			doc.name = doc.name || doc._id;
			
			Document.strip(doc);

			// Build map of documents
			this.data.set(doc._id, doc);
		}
		
		// Get hierarchy levels (starting from the root items recursively) and other 
		// hierarchy related stuff.
		var rootChildren = this.getChildren();
		this.pHasConflicts = false;
		
		// Disable root conflict checks for large notebooks.
		var checkRootConflicts = true;
		var that = this;
		if (this.data.size > Config.dontCheckConflictsGloballyBeyondNumRecords) {
			//console.warn('No global conflict checks, too much data!');
			that.#app.view.message('The notebook has become very large (' + this.data.size + ' documents). Consider splitting the notebook soon! <br>Some functionality will be disabled.', 'W');
			
			checkRootConflicts = false;
		}
		
		// Meta data scan
		for (var i in rootChildren) {
			if (checkRootConflicts && (!this.pHasConflicts) && this.hasConflicts(rootChildren[i]._id, true)) {
				this.pHasConflicts = true;
			}
			
			this.applyRecursively(rootChildren[i]._id, function(d, lvl, par) {
				// Set parent reference
				d.parentDoc = par; 

				// Set hierarchy level
				d.level = lvl;
			});
		}
	}
	
	/**
	 * Add a new document
	 */
	add(doc) {
		doc.name = doc.name || doc._id;
		doc.content = doc.content || '';
		
		doc.parentDoc = this.getById(doc.parent);
		if (doc.parent) {
			doc.level = doc.parentDoc.level + 1 
		} else {
			doc.level = 0;
		}
		if (doc._conflicts && (doc._conflicts.length > 0)) this.pHasConflicts = true;
		
		this.data.set(doc._id, doc);
	}
	
	/**
	 * Sets a new parent for the given doc
	 */
	setParent(id, newParent) {
		var doc = this.getById(id);
		if (!doc) return;

		if (doc.parent == newParent) return;
		
		doc.parent = newParent;
		doc.parentDoc = this.getById(doc.parent);
		
		if (doc.parent) {
			doc.level = doc.parentDoc.level + 1 
		} else {
			doc.level = 0;
		}
	}
	
	/**
	 * Returns if the document is deleted.
	 */
	isDeleted(id) {
		var doc = this.data.get(id);
		if (!doc) return false;
		if (doc.deleted) return true;
		return false;
	}
	
	/**
	 * Returns the document with ID id or null.
	 */
	getById(id) {
		return this.data.get(id);
	}
	
	/**
	 * Returns an array with all references directly pointing to ID.
	 */
	getReferencesTo(id) {
		var ret = [];
		if (!id) return ret;
		
		for(var [key, doc] of this.data) {
			if (doc.ref == id) {
				if (doc.deleted) continue;
				
				ret.push(doc);
			}
		}
		
		return ret;
	}
	
	/**
	 * Returns if one of doc's children is a reference to targetDoc.
	 */
	containsReferenceTo(doc, targetDoc) {
		if (!doc) return false;
		if (!targetDoc) return false;

		var children = this.getChildren(doc._id);
		
		for(var c=0; c<children.length; ++c) {
			if ((children[c].type == 'reference') && (children[c].ref == targetDoc._id)) {
				return true;
			}
		}
		
		return false;
	}
	
	/**
	 * Returns true if the passed name already exists.
	 */
	documentNameExists(name) {
		for(var [key, doc] of this.data) {
			if (doc.name == name) {
				return true;
			}
		}
		return false;
	}
	
	/**
	 * Returns the size of the document in bytes, including all content, versions and attachments.
	 * If you pass the errors array, any inaccuracy errors will be recorded there.
	 */
	getSize(doc, includeChildren, errors) {
		var ret = 0;

		if (doc.stub) {
			if (!doc.hasOwnProperty('attachmentSize')) {
				// Document does not have size meta data set correctly
				if (errors) {
					errors.push({
						id: doc._id,
						inaccurate: true
					});
				}
			}
			
			ret += doc.contentSize ? doc.contentSize : 0; 
			ret += doc.attachmentSize ? doc.attachmentSize : 0;
			ret += doc.changeLogSize ? doc.changeLogSize : 0;
			ret += doc.backImageSize ? doc.backImageSize : 0;
		} else {
			ret += doc.content ? doc.content.length : 0;
			
			for(var name in doc._attachments || []) {
				if (!doc._attachments.hasOwnProperty(name)) continue;
				var att = doc._attachments[name];
				if (!att) continue;
				if (!att.length) continue;
				ret += att.length;
			}
			
			if (doc.changeLog) {
				ret += JSON.stringify(doc.changeLog).length;
			}
		}
		
		if (doc.backImage) {
			ret += JSON.stringify(doc.backImage).length;
		}
		
		// Recurse if requested
		if (includeChildren) {
			var ch = this.getChildren(doc._id);

			for (var c in ch) {
				ret += this.getSize(ch[c], true, errors);
			}
		}
		
		return ret;
	}
	
	/**
	 * Returns the last changed document inside the hierarchical children of the given doc.
	 */
	getLatest(doc) {
		if (doc.latestDoc) return doc.latestDoc;
		
		var ret = doc;
		
		var ch = this.getChildren(doc._id);
		for (var c in ch) {
			var la = this.getLatest(ch[c]);
			if (la.timestamp > ret.timestamp) ret = la;
		}
		
		doc.latestDoc = ret;
		return ret;
	}
	
	/**
	 * Returns if a document is a (deep) child of another document. Both must be doc IDs.
	 * Also returns true if both are equal.
	 */
	isChildOf(id1, id2, shallow) {
		if (!id1 || !id2) return false;
		if (id1 == id2) return true;

		var doc1 = this.data.get(id1);
		if (!doc1) return false;
		
		if (doc1.parent == id2) return true;
		if (!doc1.parent) return false;
		if (doc1.deleted) return false;
		
		return shallow ? false : this.isChildOf(doc1.parent, id2, true);
	}
	
	/**
	 * Reset all children buffers.
	 */
	resetChildrenBuffers() {
		this.each(function(doc) {
			delete doc.children;
			delete doc.childrenDeep;
		});
	}
	
	/**
	 * Returns all direct children of the passed doc ID, as array of documents, unsorted.
	 */
	getChildren(id, deep) {
		var docOrig = null;
		
		if (!id) {
			id = "";
		} else {
			docOrig = this.getById(id);
			
			if (!docOrig) return [];
			if (deep) {
				if (docOrig.childrenDeep) return docOrig.childrenDeep;
			} else {
				if (docOrig.children) return docOrig.children;
			}
		}
		
		var ret = [];
		for(var [key, doc] of this.data) {
			if (doc.parent == id) {
				if (doc.deleted) continue;
				
				ret.push(doc);
			}
		}
		
		if (deep) {
			var ret2 = [];
			for(var i in ret) {
				ret2.push(ret[i]);
				var chRet = this.getChildren(ret[i]._id, true);
				for(var r in chRet) {
					ret2.push(chRet[r]);
				}
			}
			ret = ret2;
		}
		
		if (docOrig) {
			if (deep) {
				docOrig.childrenDeep = ret;
			} else {
				docOrig.children = ret;
			}
		}

		return ret;
	}
	
	/**
	 * Returns if the passed ID has children or not.
	 */
	hasChildren(id) {
		for(var [key, doc] of this.data) {
			if (doc.deleted) continue;

			if (doc.parent == id) {
				return true;
			}
		}
		return false;
	}
	
	/**
	 * Returns the siblings of the passed document ID (excluding the document itself).
	 */
	getSiblings(id) {
		if (!id) {
			return [];
		} 
		
		var docOrig = this.getById(id);
		if (!docOrig) return [];
		
		var ret = [];
		var all = this.getChildren(docOrig.parent);
		for(var i in all) {
			if (all[i]._id == id) continue;
			if (all[i].deleted) continue;
				
			ret.push(all[i]);
		}
		
		return ret;
	}
	
	/**
	 * Returns if the document has conflicts. If includeChildren is set, also
	 * all deep children of the document will be scanned and true will be returned if
	 * any conflicts exist among them.
	 * 
	 * If called without ID, all documents will be regarded.
	 */
	hasConflicts(id, includeChildren) {
		if (!id) {
			return this.pHasConflicts;
		}
		
		var doc = this.getById(id);
		if (!doc) return false;
		if (doc._conflicts && (doc._conflicts.length > 0)) return true;
		
		if (includeChildren) {
			var children = this.getChildren(id);
			for (var c in children) {
				if (!children[c]._id) {
					throw new Error('Child has no ID: ' + JSON.stringify(children[c]));
				}
				if (children[c]._id == children[c].parent) {
					throw new Error('Child is its own parent: ' + JSON.stringify(children[c]));
				}
				
				if (this.hasConflicts(children[c]._id, true)) {
					return true;
				}
			}
		}
		
		return false;
	}
	
	/**
	 * Returns if the document has children or conflicts
	 */
	hasChildrenOrConflicts(id) {
		return this.hasChildren(id) || this.hasConflicts(id);
	}
	
	/**
	 * Calls the callback for the ID item and all items which are under it. 
	 * callback gets called with the doc as parameter, as well as the current 
	 * hierarchy level and the parent document of the doc if any.
	 * 
	 * NOTE: Just leave lvl and par unpassed when calling this!
	 */
	applyRecursively(id, callback, lvl, data) {
		var doc = this.data.get(id);
		if (!doc) return;

		if (!lvl) lvl = 0;
		
		callback(doc, lvl, data);
		
		var children = this.getChildren(id);
		for (var a in children) {
			this.applyRecursively(children[a]._id, callback, lvl + 1, doc);
		}
	}
	
	/**
	 * Apply a callback function to each document (unordered).
	 */
	each(callback) {
		var quit = false;
		
		/**
		 * Call this to stop the loop from within the callback function.
		 */
		function quitLoopCallback() {
			quit = true;
		}
		
		for(var [key, doc] of this.data) {
			if (doc.deleted) continue;
			
			callback(doc, quitLoopCallback);
			
			if (quit) return;
		}
	}
	
	/**
	 * Evaluate the search token. Returns if the document is visible for the given token.
	 * normallyVisible tells us if the navigation behaviour would normally show the document
	 * without a search token.
	 */
	evaluateSearch(doc, token, normallyVisible) {
		const tokenNoPrefix = token.substring(1);
		
		// Filter shown items: Remove all that contain the token
		if (token.startsWith('-')) {
			if (tokenNoPrefix.length == 0) {
				return normallyVisible;
			}
			return normallyVisible && !this.containsText(doc, tokenNoPrefix);
		}
		
		// Filter shown items: Remove all that do not contain the token
		if (token.startsWith('+')) {
			if (tokenNoPrefix.length == 0) {
				return normallyVisible;
			}
			return normallyVisible && this.containsText(doc, tokenNoPrefix);
		}
		
		// No prefix: Show all items, regardless if they would normally be shown.
		return this.containsText(doc, token);
	}
	
	/**
	 * Returns if the passed document contains the passed search string.
	 */
	containsText(doc, token) {
		if (!doc) return false;
		
		if (!Document.isLoaded(doc)) throw new Error('Document ' + doc._id + ' is not loaded');
		
		var tokenLowercase = token.toLowerCase().trim();
		
		// Hashtag only search
		if (token.startsWith('tag:')) {
			tokenLowercase = tokenLowercase.substring('tag:'.length);
			for (var l in doc.tags || []) {
				if (doc.tags[l].toLowerCase() == tokenLowercase) {
					return true;
				}
			}
			return false;
		}
		
		// Name only search
		if (token.startsWith('name:')) {
			tokenLowercase = tokenLowercase.substring('name:'.length);
			if (doc.name && (doc.name.toLowerCase().indexOf(tokenLowercase) != -1)) {
				return true;
			}
			return false;
		}
		
		// Type only search
		if (token.startsWith('type:')) {
			tokenLowercase = tokenLowercase.substring('type:'.length);
			if (doc.type && (doc.type.toLowerCase().indexOf(tokenLowercase) != -1)) {
				return true;
			}
			return false;
		}
		
		// Only search in starred docs (content and name)
		if (token.startsWith('star:')) {
			if (!doc.star) return false;
			
			tokenLowercase = tokenLowercase.substring('fav:'.length);
			if (doc.content && (doc.content.toLowerCase().indexOf(tokenLowercase) != -1)) {
				return true;
			}
			if (doc.name && (doc.name.toLowerCase().indexOf(tokenLowercase) != -1)) {
				return true;
			}
			return false;
		}

		// Search in all fields //////////////////////////////////////////////////////
		
		// Name
		if (doc.name && (doc.name.toLowerCase().indexOf(tokenLowercase) != -1)) {
			return true;
		}
		
		// Content
		if (!doc.content) return false;
		if (doc.content.toLowerCase().indexOf(tokenLowercase) != -1) {
			return true;
		}
		
		return false;
	}
	
	/**
	 * For an ID, this returns metadata for export as file. Returns an object.
	 */
	getExportFileMeta(id, separator, folderPrefix) {
		var doc = this.data.get(id);
		if (!doc) return null;
		
		var path = this.#getReadablePathRec(doc);

		var pathFull = "";
		var pathFolder = "";
		var tokens = [];
		var filename  = "";
		for(var i=path.length-1; i>=0; --i) {
			var str = path[i];
			
			if (str) {
				str = (folderPrefix ? ((i > 0) ? folderPrefix : '') : '') + Tools.escapeFilename(str);
			}
			
			pathFull += str + ((i > 0) ? separator : '');
			tokens.push(str);
			if (i == 0) {
				filename = str;	
			}
			if (i > 0) {
				pathFolder += str + ((i > 1) ? separator : '');
			}
		}
		
		if (pathFull[0] == separator) pathFull = pathFull.substring(1);
		if (pathFolder[0] == separator) pathFolder = pathFolder.substring(1);

		return { 
			id: id,
			separator: separator,			
			folderPrefix: folderPrefix,
			path: pathFull,                // Full path, including file name
			folder: pathFolder,            // Path to the file, excluding the file name
			tokens: tokens,                // Path split by separator (including file name)
			filename: filename,            // File name
		};
	}
	
	/**
	 * For an ID, this returns a HTML element with a readable, hyperlinked path.
	 * callback, if passed, is called with the doc instance as the only parameter.
	 */
	getLinkedPath(id, separator, dontAppendSeparatorAfterName, callback) {	
		if (!separator) separator = " / ";
		
		var doc = this.data.get(id);
		if (!doc) return $('<span class="' + this.#linkedPathElementClass + '" />').text('InvalidID');
		
		var path = this.#getLinkedPathRec(doc);

		var that = this;
		var ret = [];
		for(var i=path.length-1; i>=0; --i) {
			var el = path[i];
			
			if (callback) {
				$(el).on('click', function() {
					const cbdocid = $(this).data('id');
					if (!cbdocid) return;
					
					const cbdoc = that.getById(cbdocid);
					if (!cbdoc) return;
					
					callback(cbdoc);
				});
			}
			
			if (dontAppendSeparatorAfterName) {
				ret.push(el);
				if ((i > 0) && separator) {
					ret.push($('<span class="' + this.#linkedPathElementSeparatorClass + '" />').text(separator));
				}				
			} else {
				ret.push(el);  
				if (separator) { 
					ret.push($('<span class="' + this.#linkedPathElementSeparatorClass + '" />').text(separator));
				}
			}
		}
		
		return ret;
	}
	
	/**
	 * Recursive Helper for getLinkedPath().
	 */
	#getLinkedPathRec(doc, ret) {
		if (!ret) ret = [];
		
		var el = $('<span class="' + this.#linkedPathElementClass + '" />');
		el.html(doc.name ? doc.name : doc._id);
		el.data('id', doc._id);
		ret.push(el);
		
		if (!doc.parentDoc) {
			ret.push(null);  
			return ret;
		} else {
			return this.#getLinkedPathRec(doc.parentDoc, ret);
		}
	}

	/**
	 * For an ID, this returns a readable name path to root.
	 */
	getReadablePath(id, separator, dontAppendSeparatorAfterName) {
		if (!separator) separator = " / ";
		var doc = this.data.get(id);
		if (!doc) return 'InvalidID';
		
		var path = this.#getReadablePathRec(doc);

		var ret = "";
		for(var i=path.length-1; i>=0; --i) {
			var str = path[i];
			
			if (dontAppendSeparatorAfterName) {
				ret += str + ((i > 0) ? separator : '');
			} else {
				ret += str + separator;   
			}
		}
		
		return ret;
	}
	
	/**
	 * Recursive Helper for getReadablePath().
	 */
	#getReadablePathRec(doc, ret) {
		if (!ret) ret = [];
		
		ret.push(doc.name ? doc.name : doc._id);
		
		if (!doc.parentDoc) {
			ret.push('');  
			return ret;
		} else {
			return this.#getReadablePathRec(doc.parentDoc, ret);
		}
	}
	
	/**
	 * Returns a list of all documents in the notebook which contain the passed token in their readable paths. 
	 * The list contains meta objects, and does not include root.
	 */
	getLinkAutocompleteList(token) {
		if (!token) token = '';
		var that = this;
		var ret = [];
		var tokenL = token.toLowerCase();

		this.each(function(d) {
			var path = that.getReadablePath(d._id, '/', true);
			if (path[0] == '/') path = path.substring(1);
			
			if (path.toLowerCase().indexOf(tokenL) < 0) return;
			
			ret.push({
				text: path,
				displayText: d.name,
				id: d._id,
			});
		});
		
		ret.sort(function(a, b) { 
			if (a.text < b.text) return -1;
			if (a.text > b.text) return 1;
			return 0;
		});

		return ret;		
	}
	
	/**
	 * Returns a list of all available hash tags in the notebook which contain the passed token.
	 */
	getTagAutocompleteList(token) {
		if (!token) token = '';
		var ret = [];
		var tokenL = token.toLowerCase();
		
		this.each(function(doc) {
			if (doc.tags) {
				for(var i in doc.tags) {
					const tag = doc.tags[i].toLowerCase();
					if (tag.indexOf(tokenL) < 0) continue;
					
					ret.push({
						text: tag,
						id: tag,
					});
				}
			}
		});
		
		var uniqueRet = ret.filter(function(a, pos) {
	    	return ret.findIndex(function(b) {
				return (b.id == a.id);
			}) == pos;
		})
		
		return uniqueRet;
	}
	
	/**
	 * Returns all tags contained in the passed array of document instances. If docs is not passed, all documents are searched.
	 */
	getTags(docs) {
		var ret = [];
			
		if (docs) {
			for(var i in docs) {
				for(var t in docs[i].tags || []) {
					ret.push(docs[i].tags[t].toLowerCase());
				}
			}
		} else {
			for(var [key, doc] of this.data) {
				if (doc.deleted) continue;
				
				for(var t in doc.tags || []) {
					ret.push(doc.tags[t].toLowerCase());
				}
			}
		}
		
		var uniqueRet = ret.filter(function(a, pos) {
	    	return ret.findIndex(function(b) {
				return (b == a);
			}) == pos;
		})
		
		return uniqueRet;
	}
	
	/**
	 * Returns an array with all documents featuring the passed tag.
	 */
	getDocumentsWithTag(tagname) {
		if (!tagname) return [];
		var ret = [];
		
		this.each(function(doc) {
			if (doc.tags) {
				for(var i in doc.tags) {
					if (doc.tags[i] != tagname) continue;
					
					ret.push(doc);
					
					break;
				}
			}
		});
		
		return ret;
	}
	
	/**
	 * Returns all found (outgoing) references of the document to ther documents as meta array.
	 */
	getAllReferences(doc) {
		if (!doc) return [];
		
		var ret = [];
		
		// Parent
		if (doc.parent) {
			ret.push({
				id: doc.parent,
				type: 'parent',
				incoming: true
			});
		}
		
		// Reference target
		if ((doc.type == 'reference') && doc.ref) {
			ret.push({
				id: doc.ref,
				type: 'reference'
			});
		}
		
		// Links in content
		if ((doc.type == 'note') && (doc.links)) {
			for(var i=0; i<doc.links.length; ++i) {
				ret.push({
					id: doc.links[i],
					type: 'link'
				});
			}
		}

		return ret;
	}
	
	/**
	 * Reset all backlink buffers.
	 */
	resetBacklinks() {
		this.each(function(doc) {
			delete doc.backlinks;
		});
	}
	
	/**
	 * Returns all backlings of a document as array of meta objects.
	 */
	getBacklinks(doc) {
		if (!doc) return [];
		
		if (doc.backlinks) {
			return doc.backlinks;
		}
		
		var ret = [];
		var that = this;
		this.each(function(d) {
			var linktype = that.hasLinkTo(d, doc);
			if (linktype == 'link') {
				ret.push({
					doc: d,
					type: linktype
				});
			}
		});
		
		doc.backlinks = ret;
		
		return ret;
	}
	
	/**
	 * Returns if the document has a backlink to the target id.
	 */
	hasBackLinkTo(doc, targetId) {
		if (!doc) return false;
		if (!targetId) return false;

		var backlinks = this.getBacklinks(doc);
		if (!backlinks) return false;
		
		for(var l=0; l<backlinks.length; ++l) {
			//if (backlinks[l].type != 'link') continue;
			
			if (backlinks[l].doc._id == targetId) return true;
		}
		return false;
	}
	
	/**
	 * Returns if the two documents are connected in the given direction
	 */
	hasLinkTo(srcDoc, tarDoc) {
		if (!srcDoc) return false;
		if (!tarDoc) return false;
		
		// Parent
		if (srcDoc.parent && (srcDoc.parent == tarDoc._id)) return 'parent';
		
		// Reference target
		if ((srcDoc.type == 'reference') && srcDoc.ref && (srcDoc.ref == tarDoc._id)) return 'reference';
		
		// Links in content
		if ((srcDoc.type == 'note') && (srcDoc.links)) {
			for(var i=0; i<srcDoc.links.length; ++i) {
				if (srcDoc.links[i] == tarDoc._id) return 'link';
			}
		}
		
		return false;
	}
	
	/**
	 * Returns an array holding all non-deleted starred documents.
	 */
	getStarredDocs() {
		var ret = [];
		
		this.each(function(doc) {
			if (doc.deleted) return;
			if (doc.star) ret.push(doc);
		});
		
		return ret;
	}
	
	/**
	 * Get a speaking document id from a string.
	 */
	generateIdFrom(str, addSeed) {
		if (!str) {
			throw new Error('INTERNAL ERROR: Cannot generate ID for root');
		}
		
		var s = str.replace(/[^a-zA-Z0-9]/g, "-");
		if (s.length > 30) s = s.substring(0, 30);		
		var ret = s + '-' + Tools.getUuid(addSeed);
		
		if (this.getById(ret)) {
			throw new Error('INTERNAL ERROR: Generated ID already exists: ' + ret);
		}
		
		return ret;
	}
}