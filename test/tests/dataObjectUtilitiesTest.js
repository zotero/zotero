"use strict";

describe("Zotero.DataObjectUtilities", function() {
	describe("#patch()", function () {
		it("should omit 'collections' if it doesn't exist", function* () {
			var patchBase = {
				collections: ['AAAAAAAA']
			};
			var obj = {};
			obj = Zotero.DataObjectUtilities.patch(patchBase, obj);
			assert.notProperty(obj, 'collections');
		})
		
		it("should include modified 'conditions'", function* () {
			var patchBase = {
				name: "Search",
				conditions: [
					{
						condition: 'title',
						operator: 'is',
						value: 'A'
					},
					{
						condition: 'language',
						operator: 'is',
						value: 'en'
					}
				]
			};
			var obj = {
				name: "Search",
				conditions: [
					{
						condition: 'title',
						operator: 'is',
						value: 'B'
					},
					{
						condition: 'language',
						operator: 'is',
						value: 'en'
					}
				]
			};
			obj = Zotero.DataObjectUtilities.patch(patchBase, obj);
			assert.property(obj, 'conditions');
			assert.equal(obj.conditions[0].value, 'B');
			assert.equal(obj.conditions[1].value, 'en');
		})
		
		it("should blank out deleted properties", function () {
			var patchBase = {
				title: 'Test',
				place: ''
			};
			var obj = {};
			obj = Zotero.DataObjectUtilities.patch(patchBase, obj);
			assert.propertyVal(obj, 'title', '');
			// place was already empty, so it shouldn't be included
			assert.notProperty(obj, 'place');
		});
	})
	
	describe("#diff()", function () {
		// This is mostly covered by syncLocal::_reconcileChanges() tests, but we test some
		// additional things here
		describe("items", function () {
			//
			// Fields
			//
			describe("fields", function () {
				it("should not show empty items as different", function* () {
					var id1, id2, json1, json2;
					yield Zotero.DB.executeTransaction(function* () {
						var item = new Zotero.Item('book');
						id1 = yield item.save();
						json1 = item.toJSON();
						
						var item = new Zotero.Item('book');
						id2 = yield item.save();
						json2 = item.toJSON();
					});
					
					var changes = Zotero.DataObjectUtilities.diff(json1, json2);
					assert.lengthOf(changes, 0);
					
					yield Zotero.Items.erase([id1, id2]);
				})
				
				it("should not show empty strings as different", function () {
					var json1 = {
						title: ""
					};
					var json2 = {
						title: ""
					};
					var changes = Zotero.DataObjectUtilities.diff(json1, json2);
					assert.lengthOf(changes, 0);
				})
				
				it("should not show empty string and undefined as different", function () {
					var json1 = {
						title: ""
					};
					var json2 = {
						place: ""
					};
					var changes = Zotero.DataObjectUtilities.diff(json1, json2);
					assert.lengthOf(changes, 0);
				})
			})
			
			//
			// Creators
			//
			describe("creators", function () {
				it("should not show identical creators as different", function () {
					var json1 = {
						creators: [
							{
								name: "Center for History and New Media",
								creatorType: "author"
							}
						]
					};
					var json2 = {
						creators: [
							{
								creatorType: "author",
								name: "Center for History and New Media"
							}
						]
					};
					var changes = Zotero.DataObjectUtilities.diff(json1, json2);
					assert.lengthOf(changes, 0);
				})
				
				it("should not show an empty creators array and a missing one as different", function () {
					var json1 = {
						creators: []
					};
					var json2 = {};
					var changes = Zotero.DataObjectUtilities.diff(json1, json2);
					assert.lengthOf(changes, 0);
					
					var json1 = {};
					var json2 = {
						creators: []
					};
					var changes = Zotero.DataObjectUtilities.diff(json1, json2);
					assert.lengthOf(changes, 0);
		
				})
			})
			
			describe("notes", function () {
				it("should ignore sanitization changes", function* () {
					var json1 = {
						note: "<p>\u00a0</p>"
					};
					var json2 = {
						note: "<p>&nbsp;</p>"
					};
					var changes = Zotero.DataObjectUtilities.diff(json1, json2);
					assert.lengthOf(changes, 0);
				});
			});
			
			//
			// Relations
			//
			describe("relations", function () {
				it("should not show an empty relations object and a missing one as different", function () {
					var json1 = {
						relations: {}
					};
					var json2 = {
					};
					var changes = Zotero.DataObjectUtilities.diff(json1, json2);
					Zotero.debug(changes);
					assert.lengthOf(changes, 0);
					
					var json1 = {};
					var json2 = {
						relations: {}
					};
					var changes = Zotero.DataObjectUtilities.diff(json1, json2);
					Zotero.debug(changes);
					assert.lengthOf(changes, 0);
				})
			})
			
			//
			// Tags
			//
			describe("tags", function () {
				it("should not show manual tags with or without 'type' property as different", function () {
					var json1 = {
						tags: [
							{
								tag: "Foo"
							}
						]
					};
					var json2 = {
						tags: [
							{
								tag: "Foo",
								type: 0
							}
						]
					};
					var changes = Zotero.DataObjectUtilities.diff(json1, json2);
					assert.lengthOf(changes, 0);
				})
				
				it("should show tags of different types as different", function () {
					var json1 = {
						tags: [
							{
								tag: "Foo"
							}
						]
					};
					var json2 = {
						tags: [
							{
								tag: "Foo",
								type: 1
							}
						]
					};
					var changes = Zotero.DataObjectUtilities.diff(json1, json2);
					assert.sameDeepMembers(
						changes,
						[
							{
								field: "tags",
								op: "member-remove",
								value: {
									tag: "Foo"
								}
							},
							{
								field: "tags",
								op: "member-add",
								value: {
									tag: "Foo",
									type: 1
								}
							}
						]
					);
				})
			})
		})
		
		//
		// Searches
		//
		//
		// Search conditions
		//
		describe("searches", function () {
			describe("conditions", function () {
				it("should not show an empty conditions object and a missing one as different", function () {
					var json1 = {
						conditions: {}
					};
					var json2 = {
					};
					var changes = Zotero.DataObjectUtilities.diff(json1, json2);
					Zotero.debug(changes);
					assert.lengthOf(changes, 0);
					
					var json1 = {};
					var json2 = {
						conditions: {}
					};
					var changes = Zotero.DataObjectUtilities.diff(json1, json2);
					Zotero.debug(changes);
					assert.lengthOf(changes, 0);
				})
				
				/*it("should not show an empty conditions object and a missing one as different", function () {
					var json1 = {
						conditions: []
					};
					var json2 = {
						conditions: [
							{
								condition: 'title',
								operator: 'contains',
								value: 'test'
							}
						]
					};
					var changes = Zotero.DataObjectUtilities.diff(json1, json2);
					Zotero.debug(changes);
					assert.lengthOf(changes, 0);
					
					var json1 = {};
					var json2 = {
						conditions: {}
					};
					var changes = Zotero.DataObjectUtilities.diff(json1, json2);
					Zotero.debug(changes);
					assert.lengthOf(changes, 0);
				})*/
			})
		})
	})
	
	
	describe("#applyChanges()", function () {
		//
		// Fields
		//
		describe("fields", function () {
			it("should set added/modified field values", function () {
				var json = {
					title: "A"
				};
				var changes = [
					{
						field: "title",
						op: "add",
						value: "B"
					},
					{
						field: "date",
						op: "modify",
						value: "2015-05-19"
					}
				];
				Zotero.DataObjectUtilities.applyChanges(json, changes);
				assert.equal(json.title, "B");
				assert.equal(json.date, "2015-05-19");
			})
		})
		
		//
		// Collections
		//
		describe("collections", function () {
			it("should add a collection", function () {
				var json = {
					collections: ["AAAAAAAA"]
				};
				var changes = [
					{
						field: "collections",
						op: "member-add",
						value: "BBBBBBBB"
					}
				];
				Zotero.DataObjectUtilities.applyChanges(json, changes);
				assert.sameMembers(json.collections, ["AAAAAAAA", "BBBBBBBB"]);
			})
			
			it("should not duplicate an existing collection", function () {
				var json = {
					collections: ["AAAAAAAA"]
				};
				var changes = [
					{
						field: "collections",
						op: "member-add",
						value: "AAAAAAAA"
					}
				];
				Zotero.DataObjectUtilities.applyChanges(json, changes);
				assert.sameMembers(json.collections, ["AAAAAAAA"]);
				assert.lengthOf(json.collections, 1);
			})
			
			it("should remove a collection", function () {
				var json = {
					collections: ["AAAAAAAA"]
				};
				var changes = [
					{
						field: "collections",
						op: "member-remove",
						value: "AAAAAAAA"
					}
				];
				Zotero.DataObjectUtilities.applyChanges(json, changes);
				assert.lengthOf(json.collections, 0);
			})
		})
		
		//
		// Relations
		//
		describe("relations", function () {
			it("should add a predicate and object to an empty relations object", function () {
				var json = {
					relations: {}
				};
				var changes = [
					{
						field: "relations",
						op: "property-member-add",
						value: {
							key: "a",
							value: "A"
						}
					}
				];
				Zotero.DataObjectUtilities.applyChanges(json, changes);
				assert.sameDeepMembers([json.relations], [{ a: ["A"] }]);
			})
			
			it("should add a predicate and object to a missing relations object", function () {
				var json = {};
				var changes = [
					{
						field: "relations",
						op: "property-member-add",
						value: {
							key: "a",
							value: "A"
						}
					}
				];
				Zotero.DataObjectUtilities.applyChanges(json, changes);
				assert.sameDeepMembers([json.relations], [{ a: ["A"] }]);
			})
			
			it("should add an object to an existing predicate string", function () {
				var json = {
					relations: {
						a: 'A1'
					}
				};
				var changes = [
					{
						field: "relations",
						op: "property-member-add",
						value: {
							key: "a",
							value: "A2"
						}
					}
				];
				Zotero.DataObjectUtilities.applyChanges(json, changes);
				assert.sameDeepMembers([json.relations], [{ a: ["A1", "A2"] }]);
			})
			
			it("should add an object to an existing predicate array", function () {
				var json = {
					relations: {
						a: ['A1']
					}
				};
				var changes = [
					{
						field: "relations",
						op: "property-member-add",
						value: {
							key: "a",
							value: "A2"
						}
					}
				];
				Zotero.DataObjectUtilities.applyChanges(json, changes);
				assert.sameDeepMembers([json.relations], [{ a: ['A1', 'A2'] }]);
			})
			
			it("should ignore a removal for an missing relations object", function () {
				var json = {};
				var changes = [
					{
						field: "relations",
						op: "property-member-remove",
						value: {
							key: "a",
							value: "A"
						}
					}
				];
				Zotero.DataObjectUtilities.applyChanges(json, changes);
				assert.notProperty(json, 'relations');
			})
			
			it("should ignore a removal for a missing relations predicate", function () {
				var json = {
					relations: {}
				};
				var changes = [
					{
						field: "relations",
						op: "property-member-remove",
						value: {
							key: "a",
							value: "A"
						}
					}
				];
				Zotero.DataObjectUtilities.applyChanges(json, changes);
				assert.lengthOf(Object.keys(json.relations), 0);
			})
			
			it("should ignore a removal for a missing object", function () {
				var json = {
					relations: {
						a: ['A1']
					}
				};
				var changes = [
					{
						field: "relations",
						op: "property-member-remove",
						value: {
							key: "a",
							value: "A2"
						}
					}
				];
				Zotero.DataObjectUtilities.applyChanges(json, changes);
				assert.sameDeepMembers([json.relations], [{ a: ['A1'] }]);
			})
			
			it("should remove a predicate and object string from a relations object", function () {
				var json = {
					relations: {
						a: "A"
					}
				};
				var changes = [
					{
						field: "relations",
						op: "property-member-remove",
						value: {
							key: "a",
							value: "A"
						}
					}
				];
				Zotero.DataObjectUtilities.applyChanges(json, changes);
				assert.lengthOf(Object.keys(json.relations), 0);
			})
			
			it("should remove a predicate and object array from a relations object", function () {
				var json = {
					relations: {
						a: ["A"]
					}
				};
				var changes = [
					{
						field: "relations",
						op: "property-member-remove",
						value: {
							key: "a",
							value: "A"
						}
					}
				];
				Zotero.DataObjectUtilities.applyChanges(json, changes);
				assert.lengthOf(Object.keys(json.relations), 0);
			})
			
			it("should remove an object from an existing predicate array", function () {
				var json = {
					relations: {
						a: ['A1', 'A2']
					}
				};
				var changes = [
					{
						field: "relations",
						op: "property-member-remove",
						value: {
							key: "a",
							value: "A2"
						}
					}
				];
				Zotero.DataObjectUtilities.applyChanges(json, changes);
				assert.sameDeepMembers([json.relations], [{ a: ["A1"] }]);
			})
		})
		
		//
		// Tags
		//
		describe("tags", function () {
			it("should add a tag", function () {
				var json = {
					tags: [
						{
							tag: "A"
						}
					]
				};
				var changes = [
					{
						field: "tags",
						op: "member-add",
						value: {
							tag: "B"
						}
					}
				];
				Zotero.DataObjectUtilities.applyChanges(json, changes);
				assert.sameDeepMembers(
					json.tags,
					[
						{
							tag: "A"
						},
						{
							tag: "B"
						}
					]
				);
			})
			
			it("should not duplicate an existing tag", function () {
				var json = {
					tags: [
						{
							tag: "A"
						}
					]
				};
				var changes = [
					{
						field: "tags",
						op: "member-add",
						value: {
							tag: "A"
						}
					}
				];
				Zotero.DataObjectUtilities.applyChanges(json, changes);
				assert.sameDeepMembers(
					json.tags,
					[
						{
							tag: "A"
						}
					]
				);
				assert.lengthOf(json.tags, 1);
			})
			
			it("should remove a tag", function () {
				var json = {
					tags: [
						{
							tag: "A"
						}
					]
				};
				var changes = [
					{
						field: "tags",
						op: "member-remove",
						value: {
							tag: "A"
						}
					}
				];
				Zotero.DataObjectUtilities.applyChanges(json, changes);
				assert.lengthOf(json.tags, 0);
			})
		})
		
		
		//
		// Search conditions
		//
		describe("conditions", function () {
			it("should add a condition", function () {
				var json = {
					conditions: [
						{
							condition: "title",
							op: "contains",
							value: "A"
						}
					]
				};
				var changes = [
					{
						field: "conditions",
						op: "member-add",
						value: {
							condition: "title",
							op: "contains",
							value: "B"
						}
					}
				];
				Zotero.DataObjectUtilities.applyChanges(json, changes);
				assert.sameDeepMembers(
					json.conditions,
					[
						{
							condition: "title",
							op: "contains",
							value: "A"
						},
						{
							condition: "title",
							op: "contains",
							value: "B"
						}
					]
				);
			})
			
			it("should remove a condition", function () {
				var json = {
					conditions: [
						{
							condition: "title",
							op: "contains",
							value: "A"
						},
						{
							condition: "title",
							op: "contains",
							value: "B"
						}
					]
				};
				var changes = [
					{
						field: "conditions",
						op: "member-remove",
						value: {
							condition: "title",
							op: "contains",
							value: "B"
						}
					}
				];
				Zotero.DataObjectUtilities.applyChanges(json, changes);
				assert.sameDeepMembers(
					json.conditions,
					[
						{
							condition: "title",
							op: "contains",
							value: "A"
						}
					]
				);
			})
		})
	})
})
