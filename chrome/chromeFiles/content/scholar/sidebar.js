var treeView = {
	treebox: null,
	dataObjects: null,
	
    get rowCount() { return this.dataObjects.length; },
    getCellText: function(row,column){
      	obj = this.dataObjects[row];
      	
      	if(column.id == "title_column")
      	{
      		return obj.getField("title");
      	}
      	else if(column.id == "creator_column")
      	{
      		return obj.getField("firstCreator");
      	}
      	else
      	{
      		return obj.getField("source");
      	}
    },
    setTree: function(treebox){ 
    	this.treebox = treebox;
    	this.dataObjects = Scholar_Objects.getAll();
    	
        //Dan S: Check out the debug output created by this
		for(var i = 0; i < this.dataObjects.length; i++)
			Scholar.debug(Scholar.varDump(this.dataObjects[i]),5);

    },
    isContainer: function(row){ return false; },
    isSeparator: function(row){ return false; },
    isSorted: function(){ return false; },
    getLevel: function(row){ return 0; },
    getImageSrc: function(row,col){ return null; },
    getRowProperties: function(row,props){},
    getCellProperties: function(row,col,props){},
    getColumnProperties: function(colid,col,props){}
};

function setView()
{
    document.getElementById('scholar-sidebar-items').view=treeView;
}