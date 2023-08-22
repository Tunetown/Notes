/**
 * Export to Obsidian
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
class ObsidianExporter {
	
	/**
	 * Singleton factory
	 */
	static getInstance() {
		if (!ObsidianExporter.instance) ObsidianExporter.instance = new ObsidianExporter();
		return ObsidianExporter.instance;
	}
	
	/**
	 * Export Constants
	 */
	static rootIndexBasename = 'Index';                                                      ///< Name of the root index file.
	static rootIndexExtension = 'md';                                                        ///< Name of the root index file.
	static includeTimestampInOutputFileName = false;                                         ///< Include the current time stamp in the downloaded ZIP file?
	static generateBasicVaultSettings = true;                                                ///< Generate a basic .obsidian folder
	
	static addAdditionalSettings = true;                                                     ///< Add additional settings like colors, images etc. at the end of the documents?
	static additionalSettingsFilename = 'additionalNotebookSettings';                        ///< Settings of all notes are being stored in this file in the root.
	
	static exportBoardsAsKanban = true;                                                      ///< Create a kanban board instead of the standard index file, if doc is a board
	static kanbanIncludePreview = false;                                                     ///< Include some text preview in the kanban items
	static kanbanMaxPreviewLength = 100;                                                     ///< Maximum preview length for item preview
	
	/**
	 * Internal Constants
	 */
	static folderSeparator = '/';                                                            ///< Separator for creating the ZIP file.
	static rootDocId = 'obsidian-exporter-root-index-file-0d6143005ce4a443f48a898b1858d657'; ///< Internal temporary ID for the root index file. Will most likely not exist anywhere else ;)
	
	/**
	 * Export (download) documents as ZIP file. Expects an array of IDs.
	 */
	export(ids) {
		var that = this;
		
		// Array of prepared documents. This contains objects with all necessary, structured 
		// data (doc, valid export path, links as array etc.).
		var docsPrepped = [];      
		
		return Database.getInstance().get()
		.then(function(db) {
			// Load documents
			return db.allDocs({
				conflicts: true,
				include_docs: true,
				attachments: true,
				keys: ids
			});
		})
		.then(function(data) {
			if (!data.rows) {
				return Promise.reject({
					message: "Error: No data received.",
					messageThreadId: 'ExportDocsMessages'
				})
			}
			
			console.log('ObsidianExporter: Starting to export ' + data.rows.length + ' documents');
			
			// Prepare for export: This fills docsPrepped from the incoming data. This 
			// defines the whole structure of the export data.
			return that.prepareDocuments(data.rows, docsPrepped);
		})
		.then(function(/*attPromises*/) {
			var files = [];
			
			// Create file definitions for the ZIP library, 1:1 from the prepped documents. We only use the path, content 
			// and lastModified fields, everything else in docsPrepped is just used during preparation.
			for(var i=0; i<docsPrepped.length; ++i) {
				var dp = docsPrepped[i];

				files.push({
					name: dp.path,
					lastModified: dp.lastModified,
					input: dp.content
				});
			}
			
			// On demand, create some basic valut settings.
			if (ObsidianExporter.generateBasicVaultSettings) {
				var numObsFiles = that.createBasicVaultSettings(files);
				
				console.log(' -> Added ' + numObsFiles + ' Obsidian settings files');
			}
			
			// On demand, add some further settings from the doc to the file to be parsed later by future Obsidian plugins.
			if (ObsidianExporter.addAdditionalSettings) {
				var settingsFile = that.addAdditionalSettingsToPreppedFiles(docsPrepped);
				files.push(settingsFile);
				
				console.log(' -> Added additional notebook settings file: ' + settingsFile.name);
			}

			console.log(' -> Finished converting. Creating ZIP containing  ' + files.length + ' documents');
			
			// Get the ZIP stream in a Blob (this function comes from the client-zip module)
			return downloadZip(files).blob();
		})
		.then(function(blob) {
			// Create an URL for the data blob
			var url = URL.createObjectURL(blob);
			
			// Compose the output ZIP file name
			var zipname = Settings.getInstance().settings.dbAccountName + (ObsidianExporter.includeTimestampInOutputFileName ? (' ' + new Date().toLocaleString()) : '') + '.zip';
			
			// Save the ZIP file on the client computer
			window.saveAs(url, zipname);
			
			return Promise.resolve({
				ok: true,
				filename: zipname,
				docs: docsPrepped
			});
		}); 
	}
	
	/**
	 * From the docs array coming from the app, this prepared the documents filling them
	 * into docsPrepped.
	 */
	prepareDocuments(docs, docsPrepped) {
		var attRefs = [];
		var d = Notes.getInstance().getData();

		// Add the root index file
		var rootDoc = this.createRootIndexDoc();
		docsPrepped.push(rootDoc);
		
		// Pre-sort the raw doc data that folders come first. This is important for the file name
		// collision detection later.
		docs.sort(function(a, b) {
			var akpi = d.hasChildren(a.doc._id) ? 1 : -1;
			var bkpi = d.hasChildren(b.doc._id) ? 1 : -1;
			return bkpi - akpi;
		});
		
		// Prepare files to be exported. This collects the files in docsPrepped[].
		// At the same time, promises will be collected to load all attachment data. These will be 
		// resolved before the files can actually be zipped.
		var promises = [];
		for(var i in docs) {
			var doc = docs[i].doc;
			
			// Add the document
			this.prepareDocument(docsPrepped, attRefs, promises, doc);
		}
		
		// If enabled, create obsidian kanban board contents for all boards
		if (ObsidianExporter.exportBoardsAsKanban) {
			this.createObsidianBoards(docsPrepped);
		}
		
		// Here, all docs are present, so we can care about the linkages between them:
		// This does all linkage (parents, references and attachments) and store the linkages in the 
		// link arrays of each prepped document.
		var linkagesMeta = this.prepareDocumentLinkages(docs, docsPrepped, attRefs, rootDoc);
		
		// This finally will evaluate the links composed above and add them to the file contents, if any.					
		this.addLinksToContents(docsPrepped);
		
		// Log some stats and we are finished here.
		var errCnt = 
			linkagesMeta.parents.errors + 
			linkagesMeta.refs.linksIgnored + 
			linkagesMeta.atts.linksIgnored + 
			linkagesMeta.boards.linksIgnored + 
			linkagesMeta.labels.labelsIgnored;
			
		console.log('Result: ' + docsPrepped.length + ' file documents (incl. root index)');
		console.log('Statistics: ');
		console.log(' -> Total amount of ignored linkages: ' + errCnt);
		console.log('   -> ' + (docs.length - docsPrepped.length - linkagesMeta.refs.linksAdded + 1) + ' unexported documents left (see warnings/errors since export start)');
		console.log('   -> Detailed statistics: See next line');
		console.log(linkagesMeta);
		
		return Promise.all(promises);
	}
	
	/**
	 * Fills the docsPrepped, attRefs and promises arrays by the passed doc. Returns nothing.
	 */
	prepareDocument(docsPrepped, attRefs, promises, doc) {
		var d = Notes.getInstance().getData();
		var that = this;
		
		// Get file path. This removes illegal characters.
		var meta = d.getExportFileMeta(doc._id, ObsidianExporter.folderSeparator);

		// The rest depends on the document type.
		switch (doc.type) {
			// Simple note: These are just added 1:1
			case 'note': {
				var addedMeta = this.addFile(
					docsPrepped,
					meta.folder, 
					meta.filename,
					'md', 
					doc, 
					doc.content
				);
				if (!addedMeta) {
					console.log(' ==>> ERROR: Error prepping note: ' + doc._id);
				}
				break;
			}

			// References are handled later, when all other documents have been prepped.
			case 'reference': {
				break;
			}
			
			// Attachments: We add these without content here, and store reference to it in a separate
			// array. This is later used by linkDocuments() to reference the file in the corr. index note.
			case 'attachment': {
				var addedMeta = this.addFile(
					docsPrepped,
					meta.folder, 
					Tools.escapeFilename(doc.attachment_filename),
					'',
					doc, 
					''
				);
				if (!addedMeta) {
					console.log(' ==>> ERROR: Error prepping attachment note: ' + doc._id);
					return;
				}
				
				// Reference array for later linkage
				attRefs.push({
					doc: doc,
					name: addedMeta.path,
					visibleName: addedMeta.filename
				});

				// Late loading for content	of attachments. The callback sets the content attribute.
				// The promise will be resolved before the next steps.
				promises.push(
					AttachmentActions.getInstance().getAttachmentUrl(doc._id)
					.then(function(ret) {
						// Find the attachment's prepped doc by the passed ID
						var adoc = that.getPreppedDocById(docsPrepped, ret.id);
						if (!adoc) {
							console.log(" ==>> ERROR: Attachment " + ret.id + " failed to load");
							return;
						}

						// Set the blob as content for the file.
						adoc.content = ret.blob;
						
						return Promise.resolve(adoc);
					})
				);
				
				break;
			}
			
			default: {
				console.log('ERROR: Invalid document type ' + doc.type);
			}
		}
	}
	
	/**
	 * Link the prepped documents according to the prepared link arrays. Stores the links in the
	 * links arrays of the prepped documents (not yet in the content!). 
	 *
	 * Returns a meta object holding some stats.
	 */
	prepareDocumentLinkages(docsInternal, docsPrepped, attRefs, rootDoc) {
		var parentsStats = this.createParentLinkages(docsPrepped, rootDoc);
		var refsStats = this.createReferenceLinkages(docsPrepped, rootDoc, docsInternal);
		var attsStats = this.createAttachmentLinkages(docsPrepped, rootDoc, attRefs);
		var labelStats = this.createLabelLinkages(docsPrepped, rootDoc);
		var boardStats = this.createBoardLinkages(docsPrepped, rootDoc, docsInternal);
		
		// Return statistics meta object.
		return {
			refs: refsStats,
			atts: attsStats,
			parents: parentsStats,
			labels: labelStats,
			boards: boardStats,
		}
	}
	
	/**
	 * Generates linkages to parents for all documents. Returns the amount of links generated.
	 */
	createParentLinkages(docsPrepped, rootDoc) {
		var cnt = 0;
		var errors = 0;
		
		// Parents: Add a link to all documents pointing to their parents.
		for(var i=0; i<docsPrepped.length; ++i) {
			var dp = docsPrepped[i];
			
			var par;
			if (dp.doc.parent) {
				par = this.getPreppedDocById(docsPrepped, dp.doc.parent);
				if (!par) {
					console.log(' ==>> ERROR: Parent does not exist for ' + dp.id);
					++errors;
					continue;
				}
			} else {
				par = rootDoc;		
			}
			
			if ((dp.doc.type == 'attachment') || (ObsidianExporter.exportBoardsAsKanban && (dp.doc.type == 'note') && (dp.doc.editor == 'board'))) {
				// This is normal: Attachments and boards cannot store links themselves, so 
				// we reference them in the index file of the parent (this is done 
				// in createAttachmentLinkages() and createBoardLinkages())			
				continue;
			}
			
			dp.links.push({
				link: par.path,
				name: par.doc.name,
				type: 'parent'
			});
			
			++cnt;	
		}
		
		return {
			linksAdded: cnt,
			errors: errors
		};
	}
	
	/**
	 * Generates linkages to references for all documents. Returns the amount of links generated.
	 */
	createReferenceLinkages(docsPrepped, rootDoc, docsInternal) {
		var cnt = 0;
		var linksIgnored = 0;
		
		// References: Add a link at the referenced document, pointing to the parent.
		for(var i=0; i<docsInternal.length; ++i) {
			var doc = docsInternal[i].doc;
			if (doc.type != 'reference') continue;
			
			var ref = this.getPreppedDocById(docsPrepped, doc.ref);
			if (!ref) {
				console.log(' ==>> ERROR: Reference target does not exist for ' + doc._id);
				++linksIgnored;
				continue;
			}

			var par;
			if (doc.parent) {
				par = this.getPreppedDocById(docsPrepped, doc.parent);
				if (!par) {
					console.log(' ==>> ERROR: Reference parent does not exist for ' + doc._id);
					++linksIgnored;
					continue;
				}
			} else {
				par = rootDoc;
			}
					
			if ((ref.doc.type == 'note') && (ref.doc.editor == 'board')) {
				// If the referenced document is a board itself, it is linked in its parent instead (just the opposite way).
				if (par.doc.type == 'attachment') {
					console.log(' ==>> ERROR: Reference between attachments and boards is not possible: ' + par.path + ' -> ' + ref.path);
					++linksIgnored;
					continue;
				}
				
				if ((par.doc.type == 'note') && (par.doc.editor == 'board')) {
					console.log(' ==>> ERROR: Reference between two boards is not possible: ' + par.path + ' -> ' + ref.path);
					++linksIgnored;
					continue;
				}
				
				par.links.push({
					link: ref.path,
					name: ref.doc.name,
					type: 'board'
				});
					
			} else if (ref.doc.type == 'attachment') {
				// If the referenced document is an attachment itself, it is linked in its parent instead (just the opposite way).
				if (par.doc.type == 'attachment') {
					console.log(' ==>> ERROR: Reference between two attachments is not possible: ' + par.path + ' -> ' + ref.path);
					++linksIgnored;
					continue;
				}
				
				if ((par.doc.type == 'note') && (par.doc.editor == 'board')) {
					console.log(' ==>> ERROR: Reference between boards and attachments is not possible: ' + par.path + ' -> ' + ref.path);
					++linksIgnored;
					continue;
				}
				
				par.links.push({
					link: ref.path,
					name: ref.doc.name,
					type: 'attachment'
				});	
			
			} else {
				ref.links.push({
					link: par.path,
					name: par.doc.name,
					type: 'reference'
				});			
			}
					
			
			++cnt;
		}

		return {
			linksAdded: cnt,
			linksIgnored: linksIgnored,
		};
	}
	
	/**
	 * Generates linkages to attachments for all documents. Returns the amount of links generated.
	 */
	createAttachmentLinkages(docsPrepped, rootDoc, attRefs) {
		var cnt = 0;
		var linksIgnored = 0;
		
		// Attachments: Add a link to the parent TOC document.
		for(var i=0; i<attRefs.length; ++i) {
			var ar = attRefs[i];
			
			var par;
			if (ar.doc.parent) {
				par = this.getPreppedDocById(docsPrepped, ar.doc.parent);
				if (!par) {
					console.log(' ==>> ERROR: Attachment parent does not exist for ' + ar.doc._id);
					++linksIgnored;
					continue;
				}
			} else {
				par = rootDoc;
			}
			
			if (par.doc.type == 'attachment') {
				console.log(' -> (Att) Link ignored from attachment file ' + par.path + ' to: ' + ar.name);
				++linksIgnored;
				continue;
			}
			
			par.links.push({
				link: ar.name,
				name: ar.visibleName,
				type: 'attachment'
			});
			
			++cnt;	
		}
		
		return {
			linksAdded: cnt,
			linksIgnored: linksIgnored,
		};
	}
	
	/**
	 * Create linkages for boards
	 */
	createBoardLinkages(docsPrepped, rootDoc, docsInternal) {
		var cnt = 0;
		var linksIgnored = 0;
		
		// Attachments: Add a link to the parent TOC document.
		for(var i=0; i<docsInternal.length; ++i) {
			var doc = docsInternal[i].doc;
			if (doc.type != 'note') continue;
			if (doc.editor != 'board') continue;
			
			var dp = this.getPreppedDocById(docsPrepped, doc._id);
			if (!dp) {
				console.log(' ==>> ERROR: Board file not prepared: ' + doc._id);
				++linksIgnored;
				continue;
			}
			
			var par;
			if (doc.parent) {
				par = this.getPreppedDocById(docsPrepped, doc.parent);
				if (!par) {
					console.log(' ==>> ERROR: Board parent does not exist for ' + doc._id);
					++linksIgnored;
					continue;
				}
			} else {
				par = rootDoc;
			}
			
			if (par.doc.type == 'attachment') {
				console.log(' -> (Board) Link ignored from attachment file ' + par.path + ' to: ' + doc.name);
				++linksIgnored;
				continue;
			}
			
			par.links.push({
				link: dp.path,
				name: dp.doc.name,
				type: 'board'
			});
			
			++cnt;	
		}
		
		return {
			linksAdded: cnt,
			linksIgnored: linksIgnored,
		};
	}
	
	/**
	 * Generates label links for all documents. Returns a stats object.
	 */
	createLabelLinkages(docsPrepped) {
		var d = Notes.getInstance().getData();
		
		var labelsAdded = 0;
		var labelsIgnored = 0;
		
		// Labels: These will become hashtags later.
		for(var i=0; i<docsPrepped.length; ++i) {
			var dp = docsPrepped[i];
			if (!dp.doc.labels) continue;
			
			var labels = [];
			for (var l=0; l<dp.doc.labels.length; ++l) {
				var labelId = dp.doc.labels[l];
				
				var def = d.getLabelDefinition(dp.doc._id, labelId);
				if (!def) {
					console.log(' -> Label definition ' + labelId + ' not found for file: ' + dp.path);
					++labelsIgnored;
					continue;	
				}
				
				labels.push({
					link: def.name,
					type: 'label'
				});	
			}

			if (labels.length == 0) continue;

			if (dp.doc.type == 'attachment') {
				console.log(' -> ' + labels.length + ' labels ignored for attachment file: ' + dp.path);
				labelsIgnored += labels.length;
				continue;
			}
			
			if ((dp.doc.type == 'note') && (dp.doc.editor == 'board')) {
				console.log(' -> ' + labels.length + ' labels ignored for board file: ' + dp.path);
				labelsIgnored += labels.length;
				continue;
			}
			
			// Add labels to links list
			for(var k=0; k<labels.length; ++k) {
				dp.links.push(labels[k]);
				++labelsAdded;	
			}
		}
		
		return {
			labelsAdded: labelsAdded,
			labelsIgnored: labelsIgnored,
		};
	}
	
	/**
	 * Adds the passed document as file to the docsPrepped array. Returns a metadata object 
	 * about the path actually exported.
	 */
	addFile(docsPrepped, folder, basename, extension, doc, content) {
		var d = Notes.getInstance().getData();
		
		/**
		 * Compose the file base name (no escaping!) using the (optional) iteration number passed.
		 */
		function composeBasename(num) {
			return basename + ((num > 0) ? (' (' + num + ')') : '');
		}
		
		/**
		 * Compose the file name (no escaping, incl. extension) using the (optional) iteration number passed.
		 */
		function composeFilename(num) {
			return composeBasename(num) + (extension ? ('.' + extension) : '');
		}
		
		//console.log('Add ' + folder + ' / ' + composeFilename());

		///////////////////////////////////////////////////////////////////////////////////////////////////

		// Get the first proposed file name, and the folder listing of the path to it.
		var filenameOut = composeFilename();
		var parentDp = this.getPreppedDocById(docsPrepped, doc.parent);
		var parentPath = parentDp ? parentDp.folderpath : '';
		var listing = this.getChildrenOfPath(docsPrepped, parentPath);
		var basenameOut = composeBasename();
		var hasChildren = d.hasChildren(doc._id);
		
		// Check for duplicate file names across the other documents in the same folder.
		// NOTE: If there are duplicate folder names, this will lead to them being merged.
		var dupi = 0;
		while(this.listingContains(listing, hasChildren ? basenameOut : filenameOut)) {
			filenameOut = composeFilename(++dupi);
			basenameOut = composeBasename(dupi);
		}

		if (dupi > 0) {
			console.log(' -> Name collision prevented: ' + filenameOut);
		}

		var path = (folder ? (folder + ObsidianExporter.folderSeparator) : '') + filenameOut;
		var folderpath = (folder ? (folder + ObsidianExporter.folderSeparator) : '') + basename;

		// Add the prepped document
		docsPrepped.push({
			id: doc._id,
			path: path,
			filename: filenameOut,
			foldername: hasChildren ? basename : null,
			folderpath: hasChildren ? folderpath : null,
			folder: parentPath,  
			doc: doc,
			content: content,
			lastModified: new Date(),
			links: [],
			hasChildren: hasChildren,
		});
		
		// Return metadata about what happened
		return {
			path: path,
			filename: filenameOut,
			collisionIterations: dupi
		};
	}
	
	/**
	 * Adds all links to the file content.
	 */
	addLinksToContents(docsPrepped) {
		// Add all links to the top of the note content, if any
		for(var i=0; i<docsPrepped.length; ++i) {
			var dp = docsPrepped[i];

			// Remove duplicates (ignoring type, as these are never redundant)
			var uniquelinks = dp.links.filter(function(a, pos) {
		    	return dp.links.findIndex(function(b) {
					return (b.link == a.link);
				}) == pos;
			})

			////////////////////////////////////////////////////////////////////////////////
			var lines = [];

			// Header with links: Get two lines: First the parents and references, second the attachments
			var line = this.getLinksString(uniquelinks, 'parent', 'reference');
			if (line) lines.push('Topics: ' + line);

			line = this.getLinksString(uniquelinks, 'attachment');
			if (line) lines.push('Attachments: ' + line);

			line = this.getLinksString(uniquelinks, 'board');
			if (line) lines.push('Boards: ' + line);

			// Labels: These become hashtags in the front matter			
			line = this.getHashtagsString(uniquelinks, 'label');			
			if (line) lines.push(line);

			if (lines.length == 0) continue;

			if (dp.doc.type == 'attachment') {
				console.log('####### INTERNAL ERROR: No linkages allowed for attachments!!! ' + dp.path + ' ########');
				continue;
			}
			
			if ((dp.doc.type == 'note') && (dp.doc.editor == 'board')) {
				console.log('####### INTERNAL ERROR: No linkages allowed for boards!!! ' + dp.path + ' ########');
				continue;
			}
						
			var hdr = "";
			if (lines.length > 0) {
				// Add links to header string
				for(var l=0; l<lines.length; ++l) {
					if (!lines[l]) continue;
					hdr += lines[l] + ((l < lines.length-1) ? '\n' : ''); 
				}	
				hdr += '\n\n---\n\n';
			}

			// Add the content header to the document
			dp.content = hdr + dp.content; 
		}
	}
	
	/**
	 * Returns if the passed folder listing contains the passed file or folder name.
	 */
	listingContains(listing, filename) {
		if (!filename) return false;
		
		for(var i=0; i<listing.length; ++i) {
			var entry = listing[i];
			
			if (entry.filename.toLowerCase() == filename.toLowerCase()) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Returns an array containing the contents of the given folder,
	 * derived from the already prepped docs. Returns an array of objects.
	 */
	getChildrenOfPath(docsPrepped, parentPath) {
		var d = Notes.getInstance().getData();
		var ret = [];
		
		/**
		 * Checks if a name is already in the listing (as folder or file, doesnt matter here).
		 */
		function exists(name) {
			for(var i=0; i<ret.length; ++i) {
				if (ret[i].filename == name) return true;
			}
			return false;
		}
		
		/**
		 * Append listing entry
		 */
		function appendDoc(dp) {
			var isFolder = d.hasChildren(dp.id);
				
			if (isFolder) {
				// Folder get an extra entry, if not yet exists
				if (!exists(dp.foldername)) {
					ret.push({
						filename: dp.foldername,
						isFolder: true
					});
				}
			}
						
			ret.push({
				filename: dp.filename,
				isFolder: false
			});
		}
		
		// Scan all documents if they match the folder path
		for(var i=0; i<docsPrepped.length; ++i) {
			var dp = docsPrepped[i];
			
			if (parentPath) {
				// Parents exist: Normal document
				if (parentPath == dp.folder) {
					appendDoc(dp);
				}
			} else {
				// No parent path: Scanning root
				if (!dp.folder) {
					appendDoc(dp);
				}
			}
		}
		
		return ret;
	}

	/**
	 * Searches a file from docsPrepped and returns it, or null if not found.
	 */
	getPreppedDocById(docsPrepped, id) {
		if (!id) return null;
		
		for(var k=0; k<docsPrepped.length; ++k) {
			if (docsPrepped[k].id == id) {
				return docsPrepped[k];
			}						
		}
		return null;
	}
	
	/**
	 * Composes the links of the passed types into a link header. Returns one line (string).
	 */
	getLinksString(links, type1, type2) {
		var ltext = "\n";
		var cnt = 0;
		
		for(var l=0;l<links.length; ++l) {
			if ((links[l].type != type1) &&
			    (links[l].type != type2)) {
				continue;	
			}
			
			++cnt;
			ltext += "- " + this.formtLink(links[l].link, links[l].name)  + "\n";
		}
		return (cnt > 0) ? ltext : null;
	}
	
	/**
	 * Link formatting with optional visible name.
	 */
	formtLink(link, visibleName) {
		return '[[' + link + (visibleName ? ('|' + visibleName) : '') + ']]';
	}
	
	/**
	 * Composes the hashtags of the passed type into a line. Returns one line (string).
	 */
	getHashtagsString(links, type1) {
		var ltext = "\n";
		var cnt = 0;
		
		for(var l=0;l<links.length; ++l) {
			if (links[l].type != type1) {
				continue;	
			}

			++cnt;
			ltext += "#" + this.escapeHastag(links[l].link) + " ";
		}

		ltext += '\n';
		
		return (cnt > 0) ? ltext : null;
	}
	
	/** 
	 * Escapes hash tag names
	 */
	escapeHastag(name) {
		return name.replace(/[^a-zA-Z0-9._\-]/g, '').trim();
	}
	
	/**
	 * Creates the (empty) root index document (prepped object format).
	 */
	createRootIndexDoc() {
		var filename = ObsidianExporter.rootIndexBasename + (ObsidianExporter.rootIndexExtension ? ('.' + ObsidianExporter.rootIndexExtension) : '');
		
		return {
			id: ObsidianExporter.rootDocId,    
			path: filename,
			filename: filename,
			foldername: '',
			doc: { },
			content: '',
			lastModified: new Date(),
			links: [],
			hasChildren: true
		}
	}
	
	/**
	 * Adds some settings of the docs to their contents (at the end) and 
	 * returns a ZIP compatible file descriptor containing all of them.
	 */
	addAdditionalSettingsToPreppedFiles(docsPrepped) {
		return { 
			name: ObsidianExporter.additionalSettingsFilename + '.json', 
			lastModified: new Date(),
			input: JSON.stringify(this.getAdditionalSettings(docsPrepped), null, 2),
		};
	}
		
	/**
	 * Gets an array holding additional settings for all items.
	 */
	getAdditionalSettings(docsPrepped) {
		var ret = [];
		
		for(var i=0; i<docsPrepped.length; ++i) {
			var dp = docsPrepped[i];
			
			var settings = this.getDocAdditionalSettings(dp);
			
			ret.push({
				path: dp.path,
				settings: settings,
			});
		}
		
		return ret;
	}
	
	/**
	 * Take over additional settings from the document to be stored in the additional settings file
	 */
	getDocAdditionalSettings(dp) {
		return {
			color: dp.doc.color,
			backColor: dp.doc.backColor,
			order: dp.doc.order,
			backImage: dp.doc.backImage,
			changeLog: dp.doc.changeLog,
			editor: dp.doc.editor,
			editorParams: dp.doc.editorParams,
			boardState: dp.doc.boardState,
			labelDefinitions: dp.doc.labelDefinitions,
			labels: dp.doc.labels,
		};
	}
	
	/**
	 * Overwrites the contents of all board documents and generates 
	 * obsidian compatible board code in the same file.
	 */
	createObsidianBoards(docsPrepped) {
		for(var i=0; i<docsPrepped.length; ++i) {
			var dp = docsPrepped[i];
			if (dp.doc.editor != 'board') continue;

			dp.content = this.createKanbanFileContent(docsPrepped, dp);
		}
	}
	
	/**
	 * Returns the content for a obsidian kanban board file.
	 */
	createKanbanFileContent(docsPrepped, dp) {
		var d = Notes.getInstance().getData();
		
		// Startz building the content string with the frontmatter
		var ret = "---\n\nkanban-plugin: basic\n\n---\n\n";
		
		var that = this;
		function getPreppedDocById(doc, errorMsg) {
			if (doc.type == 'reference') {
				doc = d.getById(doc.ref);
				
				if (!doc) {
					console.log(' ==>> WARNING: Board Export for ' + dp.path + ': Broken reference in board : ' + doc.name);
					return null;
				}
			}
			
			var ret = that.getPreppedDocById(docsPrepped, doc._id);
			if (!ret) {
				console.log(' ==>> WARNING: Board Export for ' + dp.path + ': ' + errorMsg);
			}
			return ret;
		}
		
		// Lists
		var lists = d.getChildren(dp.doc._id);
		for(var l=0; l<lists.length; ++l) {
			var list = lists[l];
			var listDp = getPreppedDocById(list, 'Cannot find document for list: ' + list.name);
			
			var lname;
			if (!listDp) {
				lname = list.name;
			} else {
				lname = this.formtLink(listDp.path, list.name);				
			}
			
			ret += '## ' + lname + '\n\n';
			
			// Items
			var items = d.getChildren(list._id);
			for(var i=0; i<items.length; ++i) {
				var item = items[i];
				var itemDp = getPreppedDocById(item, 'Cannot find document for item: ' + item.name + ' in list ' + list.name);
				
				var iname;
				if (!itemDp) {
					iname = item.name;
				} else {
					iname = this.formtLink(itemDp.path, item.name);				
				}
				
				if (ObsidianExporter.kanbanIncludePreview && item.preview) {
					iname += '<br>' + this.formatBoardItemPreview(item.preview);
				}
				
				ret += '- [ ] ' + iname + '\n';
			}
			
			// Additional lines after each list
			ret += '\n\n';
		}

		// Footer with plugin settings		
		ret += `\n\n%% kanban:settings\n\`\`\`\n{"kanban-plugin":"basic"}\n\`\`\`\n%%`;

		return ret;
	}
	
	/**
	 * Format preview of documents (for kanban items).
	 */
	formatBoardItemPreview(preview) {
		var ret = preview.replace(/[\n]/g, ' ');
		ret = ret.slice(0, ObsidianExporter.kanbanMaxPreviewLength);
		return ret.trim();
	}
	
	/**
	 * Adds basic obsidian settings to the files. Returns the number of files added.
	 */
	createBasicVaultSettings(files) {
		var accentColor = Settings.getInstance().settings.mainColor;
		
		files.push({ name: '.obsidian/app.json', lastModified: new Date(), input: '{ "defaultViewMode": "preview", "readableLineLength": false, "newFileLocation": "folder", "newFileFolderPath": "Unsorted" }' });
		files.push({ name: '.obsidian/appearance.json', lastModified: new Date(), input: '{ "accentColor": "' + accentColor + '" }' });
		files.push({ name: '.obsidian/backlink.json', lastModified: new Date(), input: '{ "backlinkInDocument": true }' });

		if (ObsidianExporter.exportBoardsAsKanban) {
			// NOTE: You have to install the kanban plugin manually. However it is already enabled here.
			files.push({ name: '.obsidian/community-plugins.json', lastModified: new Date(), input: '[ "obsidian-kanban" ]' });
		}
		
		return 3;
	}
}