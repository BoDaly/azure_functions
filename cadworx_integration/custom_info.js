const jmespath = require('jmespath')
module.exports = class CustomInfo{

  constructor(cdl){
    const config = {}
    config.document = {}
    config.document.regions = this.getRegions(cdl)
    for(let region of config.document.regions){
      region.color = this.getRegionColor(cdl,region)
    }
    config.document.decorations = this.getDecorationAreas(cdl)
    for(let decoration of config.document.decorations){
      decoration.type = this.getDecorationType(cdl,decoration)
      decoration.content = this.getDecorationContent(cdl,decoration)
    }
    return config
  }

  getRegions(cdl){
    let expression = 'Cdl.Document[].Pages[].Page[].Layers[].Layer[].Figures[].Shape[].Attr.ZoneName'
    let result = jmespath.search(cdl,expression)
    // only keep unique keys
    const uniqueRegions = this.getUniqueNames(result)
    // make objects with regionName key and value
    let regions = []
    for(let region of uniqueRegions){
      regions.push({regionName:region})
    }
    return regions
  }

  getDecorationAreas(cdl){
    let expression = `Cdl.Document[].Pages[].Page[].Layers[].Layer[].Figures[].Shape[].Attr.DecorationAreaName`
    let result = jmespath.search(cdl,expression)
    //only keep unique keys
    const uniqueDecoNames = this.getUniqueNames(result)
    // make objects with regionName key and value
    let decoAreas = []
    for(let name of uniqueDecoNames){
      decoAreas.push({name:name})
    }
    return decoAreas
  }

  getDecorationContent(cdl,decoration){
    let result = jmespath.search(cdl,`Cdl.Document[].Pages[].Page[].Layers[].Layer[].Figures[].*[][?Attr.InDecorationArea == \`${decoration.name}\`][]`)
    return result
  }

  getDecorationType(cdl,decoration){
    let expression = `Cdl.Document[].Pages[].Page[].Layers[].Layer[].Figures[].Shape[?Attr.DecorationAreaName == \`${decoration.name}\`][].Attr.DecorationAreaType`
    let result = jmespath.search(cdl,expression)
    return result[0]
  }

  getRegionColor(cdl,region){
    let expression = `Cdl.Document[].Pages[].Page[].Layers[].Layer[].Figures[].Shape[?Attr.ZoneName == \`${region.regionName}\`][].Polyregion[].Brush[].Color[].Attr | [0]`
    let result = jmespath.search(cdl,expression)
    return result
  }

  getUniqueNames(array){
    let uniqueNames = []
    while(array.length > 0 ){
      let name = array.shift()
      if(uniqueNames.indexOf(name) === -1)uniqueNames.push(name)
    }
    return uniqueNames
  }

}
