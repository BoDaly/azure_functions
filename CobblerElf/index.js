const parseString = require('xml2js').parseString;
const xml2js = require('xml2js')
const jmespath = require('jmespath')
const CustomInfo = require('./custom_info.js')
const fetch = require('node-fetch')
const Bluebird = require('bluebird')
//const express = require('express')
//const fs = require('fs')
//const app = express()
const bodyParser = require('body-parser')
const azure = require('azure-storage')
//const Stream = require('stream')
const moment = require('moment')
const fileService = azure.createFileService('sfgintegration','QysL/x7L4y4ewHC0tvZl8s0Ocy4UOuPZary+LaLbdDmSEY9iq5NNz/09EaZ4hhZeqJSsm+SC+95E12gS3jWqng==')
fetch.Promise = Bluebird

module.exports = function (context, req) {
  let request = req.body;
  const fileName = request.file_name
  switch(true){
    case(req.body.type === "teamstore"):
      const size = request.size
      const skuArray = request.sku.match(/[A-Za-z0-9]+/g)
      const store = request.store
      const design = skuArray[2]
      const style = skuArray[0]
      const url = 'https://fullgearub.cadworxase.p.azurewebsites.net/Core2/Doc/Search'
      const body = {
        'config':"FullgearUB",
        'ident':{
          'sessionid': "947c6c7c-e7df-48a9-9ce5-46a0d5986af6",
          'superuser': false
        },
        'model':{
          'match':{
            'Name': store+"_"+request.sku.replace(/^[A-Aa-z0-9]+-/,"").replace("-","_"),
            'Tags':[
              {
                'Name':'/Production/'+store+'/'+design+'/'+style
              }
            ]
          },
          "includedata": true
        }
      }
      fetch(url,{
        'method':'POST',
        'body': JSON.stringify(body),
        'headers':{
          'Content-Type':'application/json'
        }
      }).then((result) => result.json())
        .then((result) => {
          let properties = cleanProperties(request.properties)
          decorate(result.Model.Items[0].Cdl,properties,(result)=>{
            requestPDF(result,request.fileName,(err,result)=> {
              fileUrl = {"url":result}
              context.res={
                error:err||null,
                result:(result)?"success":"fail",
                body:JSON.stringify(fileUrl)
              }
              context.done();
            })
          })
        })
    break;
    case(req.body.type === "builder"):
      getCDL(request.docId,(result)=>{
        mapCdl(result.replace(/\\"/,"\""),(err,result)=>{
          if(err){
            context.res={
              error:err||null,
              result:(result)?"success":"fail",
              body:null
            }
            context.done();
          }else{
            let fileUrl;
            getTemplateCdl(result,request,fileName,(err,result,msg)=>{
              context.log(msg)
              requestPDF(result,fileName,(err,result)=>{
                fileUrl = {"url":result}
                context.res={
                  error:err||null,
                  result:(result)?"success":"fail",
                  body:JSON.stringify(fileUrl)
                }
                context.done();
              })
            });
          }
        })
      })
    break;
  }
};

function mapCdl(cdl,callback){
    parseString(cdl,{attrkey:"Attr"},(err, result)=>{
      let customInfo = new CustomInfo(result)
      callback(null,customInfo)
    })
}

function decorate(cdl,customInfo,callback){
  parseString(cdl,{attrkey:"Attr"},(err, result)=>{
    for(let textBlock of result.Cdl.TextBlock){
      if(textBlock.Attr.Name === "PlayerName"){
        textBlock.Line = customInfo.PlayerName || ""
      }
      if(textBlock.Attr.Name === "PlayerNumber"){
        textBlock.Line = customInfo.PlayerNumber || ""
      }
    }
    let builder = new xml2js.Builder({attrkey:"Attr"})
    let decoratedCdl = builder.buildObject(result.Cdl)
    callback(decoratedCdl)
  })
}

function cleanProperties(properties){
  const newProperties = {}
  for(let property of properties){
    newProperties[property.name] = property.value
  }
  return newProperties
}

function getCDL(docId,callback){
  const url = 'https://fullgearub.cadworxase.p.azurewebsites.net/Core2/Doc/Read'
  const body = {
    "config": "FullgearUB",
    "ident": {
      "sessionid": "947c6c7c-e7df-48a9-9ce5-46a0d5986af6",
      "superuser": false
    },
    "model": {
      "Id": docId
    }
  }
  fetch(url, {
    'method': 'POST',
    'body': JSON.stringify(body),
    'headers': {
      'Content-Type':'application/json'
    }
  }).then(res => res.json())
    .then(json => callback(json.Model.Cdl))
}

function getTemplateCdl(customInfo,orderInfo,fileName,callback){
  const url = 'https://fullgearub.cadworxase.p.azurewebsites.net/Core2/Doc/Search'
  const body = {
    'config':"FullgearUB",
    'ident':{
      'sessionid': "947c6c7c-e7df-48a9-9ce5-46a0d5986af6",
      'superuser': false
    },
    "model": {
  		"match": {
  			"Name":orderInfo.size+"_"+orderInfo.style+"_"+orderInfo.design+"_"+orderInfo.model_path.replace(/\//,""),
  			"Tags":[
  				{
  					"Name":"/Production"+orderInfo.model_path+"/"+orderInfo.design+"/"+orderInfo.style
  				}
  			]
  		},
  		"includedata": true
  	}
  }
  fetch(url, {
    'method': 'POST',
    'body': JSON.stringify(body),
    'headers': {
      'Content-Type':'application/json'
    }
  }).then(res => res.json())
    .then((json) => { parseString(json.Model.Items[0].Cdl,{attrkey:"Attr"},(err,result) =>{
      //getEditPaths(customInfo,result)
      let msg;
      reconcileCdl(customInfo,result)
      splitAltFab(result,fileName,(res)=>{
        msg = res
        let builder = new xml2js.Builder({attrkey:"Attr"})
        let cdl = builder.buildObject(result)
        callback(null,cdl,msg)
      })
      //console.log(result);
    })})
}

function splitAltFab(cdl,fileName,callback){
  if(cdl.Cdl.Document){
    let index = 0;
    for(let layer of cdl.Cdl.Document[0].Layers[0].Layer){
      if(layer.Attr && layer.Attr.Name === "alt_fab"){
        let newCdl = {Cdl:layer.Figures[0]}
        let builder = new xml2js.Builder({attrkey:"Attr"})
        let altFab = builder.buildObject(newCdl)
        delete cdl.Cdl.Document[0].Layers[0].Layer[index];
        requestPDF(altFab,fileName+"_altfab",(res) => {
          callback('!---- Alternate Fabric Exported ----!')
        })
      }
      index ++
    }
    callback('!---- No Alternate Fabric Found ----!')
  }else{
    callback('!---- No Alternate Fabric Found ----!')
  }
}

function reconcileCdl(customInfo,originalCdl){
  updateRegions(customInfo,originalCdl)
  if(customInfo.document.decorations){
    for(let decoration of customInfo.document.decorations){
      if(decoration.content[0]){
        switch(true){
          case (decoration.type === "Logo" || decoration.type === "Upload" || decoration.type === "Clipart") : if(decoration.content[0].Polyregion){
            updatePositions(decoration,originalCdl)
            originalCdl.Cdl.Shape.push(decoration.content[0])
          }else {
            if(!originalCdl.Cdl.Raster) originalCdl.Cdl.Raster = []
            updatePositions(decoration,originalCdl)
            originalCdl.Cdl.Raster.push(decoration.content[0])
          }
          break;
          case (decoration.type === "Text") :
            if(!originalCdl.Cdl.TextBlock) originalCdl.Cdl.TextBlock = []
            updatePositions(decoration,originalCdl)
            originalCdl.Cdl.TextBlock.push(decoration.content[0])
        }
      }
    }
  }
}

function checkOrientation(matrix){
  let currentOrientation;
  switch(true){
    case(matrix[0] > 0 && matrix[1] == 0 && matrix[2] == 0 && matrix[3] > 0):
      currentOrientation = 0
      break;
    case(matrix[0] == 0 && matrix[1] > 0 && matrix[2] < 0 && matrix[3] == 0):
      currentOrientation = 90
      break;
    case(matrix[0] < 0 && matrix[1] == 0 && matrix[2] == 0 && matrix[3] < 0):
      currentOrientation = 180
      break;
    case(matrix[0] == 0 && matrix[1] < 0 && matrix[2] > 0 && matrix[3] == 0):
      currentOrientation = 270
  }
  return currentOrientation
}

function orientationTransform(transform,orientation){
  let transformValue = transform.reduce((total,num) => { return Math.abs(total) + Math.abs(num)})/2
  switch(true){
    case(orientation == 0):
    return [transformValue,0,0,transformValue]
    case(orientation == 90):
    return [0,transformValue,-transformValue,0]
    case(orientation == 180):
    return [-transformValue,0,0,-transformValue]
    case(orientation == 270):
    return [0,-transformValue,transformValue,0]
  }
}

function multiplyMatrixAndPoint(matrix, point) {

  //Give a simple variable name to each part of the matrix, a column and row number
  var c0r0 = matrix[ 0], c1r0 = matrix[ 1];
  var c0r1 = matrix[ 2], c1r1 = matrix[ 3];

  //Now set some simple names for the point
  var x = point[0];
  var y = point[1];

  //Multiply the point against each part of the 1st column, then add together
  var resultX = (x * c0r0) + (y * c0r1);

  //Multiply the point against each part of the 2nd column, then add together
  var resultY = (x * c1r0) + (y * c1r1);

  return [resultX, resultY];
}

function multiplyMatrices(matrixA, matrixB) {
  // Slice the second matrix up into columns
  var column0 = [matrixB[0], matrixB[2]];
  var column1 = [matrixB[1], matrixB[3]];

  // Multiply each column by the matrix
  var result0 = multiplyMatrixAndPoint(matrixA, column0);
  var result1 = multiplyMatrixAndPoint(matrixA, column1);

  // Turn the result columns back into a single matrix
  return [
    result0[0], result1[0],
    result0[1], result1[1]
  ];
}

function updateOrientation(shape,decoration){
  let shapeTransform = []
  shape.Transform[0].Attr.Matrix22.split(",").forEach((a) => {
    shapeTransform.push(Number.parseFloat(a,10))
  })
  let decoTransform = []
  decoration.content[0].Transform[0].Attr.Matrix22.split(",").forEach((a) => {
    decoTransform.push(Number.parseFloat(a,10))
  })
  let shapeOrientation = checkOrientation(shapeTransform)
  decoration.content[0].Transform[0].Attr.Matrix22 = orientationTransform(decoTransform,shapeOrientation)

}

function updatePositions(decoration,originalCdl){
  if(decoration.type && decoration.type === "Logo" || decoration.type && decoration.type === "Clipart" || decoration.type && decoration.type === "Text"){
    for(let shape of originalCdl.Cdl.Shape){
      if(shape.Attr && shape.Attr.DecorationAreaName && shape.Attr.DecorationAreaName === decoration.name){
        decoration.content[0].Pin[0].Attr.X = shape.Pin[0].Attr.X
        decoration.content[0].Pin[0].Attr.Y = shape.Pin[0].Attr.Y
        updateOrientation(shape,decoration)
      }
    }
  }
}

function updateRegions(customInfo,cdl){
  if(cdl.Cdl.Document){
    for(let layer of cdl.Cdl.Document[0].Layers[0].Layer){
      for(let shape of layer.Figures[0].Shape){
        for(let i = 0;i < customInfo.document.regions.length; i++){
          if(shape.Attr && shape.Attr.ZoneName && shape.Attr.ZoneName == customInfo.document.regions[i].regionName){
            for(let region of shape.Polyregion){
              region.Brush[0].Color[0].Attr = customInfo.document.regions[i].color
            }
          }
        }
      }
    }
  }else{
    for(let shape of cdl.Cdl.Shape){
      for(let i = 0;i < customInfo.document.regions.length; i++){
        if(shape.Attr && shape.Attr.ZoneName && shape.Attr.ZoneName == customInfo.document.regions[i].regionName){
          for(let region of shape.Polyregion){
            region.Brush[0].Color[0].Attr = customInfo.document.regions[i].color
          }
        }
      }
    }
  }
}

function requestPDF(cdl,fileName,callback){
  const url = 'https://fullgearub.cadworxase.p.azurewebsites.net/Core2/Doc/Export'
  const body = {
    "config": "FullgearUB",
    "ident": {
      "sessionid": "9acffbad-34ad-4d0e-8bc6-3b02b650c5ad",
      "superuser": true
    },
    "model": {
      "FileName": "test.pdf",
      "Doc":{"Cdl":cdl}
    }
  }
  fetch(url,{
    'method': 'POST',
    'body': JSON.stringify(body),
    'headers':{
      'Content-Type':'application/json'
    }
  }).then((res) => {
    fileService.createFileFromStream('sfg-integrationa790','production-art',fileName+'.pdf',res.body,parseInt(res.headers.get("content-length")), function(error, result, response){
      if (!error){
        const fileUrl = fileService.getUrl('sfg-integrationa790','production-art',fileName+'.pdf')
        const sasToken = fileService.generateSharedAccessSignature('sfg-integrationa790','production-art',fileName+'.pdf',{
          Id:"Cronos-Read",
          AccessPolicy:{
            Expiry: moment().add(1,"years").format("YYYY-MM-DDTHH:mm:ss")
          }
        })
        callback(null,fileUrl+'?'+sasToken)
      }else{
        callback(error,null)
      }
    })
  })
}
