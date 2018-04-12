const WooCommerceAPI = require('woocommerce-api')
const fetch = require('node-fetch')
const CronosBatch = require('./cronos-batch')
const YAML = require('yamljs')
const fs = require('fs')
const moment = require('moment')
const cronosEndPoint = "https://portal.fullgear.com/api/v1/orders/"
const staging={};
staging.on = false
staging.number = 0

//azureFunction()
function setFilterDate(type){
  const now = moment().format("YYYY-MM-DDTHH:mm:ss")
  const yesterday = moment(now).subtract(1,'days').format("YYYY-MM-DDTHH:mm:ss")
  const weekend = moment(now).subtract(2,'days').format("YYYY-MM-DDTHH:mm:ss")
  if(moment(now).day() === 0){
    if(type === "browser"){
      return weekend.replace(/\:/g, "%3A")
    }else{
      return weekend
    }
  }else{
    if(type === "browser"){
      return yesterday.replace(/\:/g, "%3A")
    }else{
      return yesterday
    }
  }
}
// Load Client Info Config (YAML)
// Iterate through Clients and .
// Get Client Orders since yesterday.
//function azureFunction(){
module.exports = function(context,myTimer){
  context.log(staging)
  const filterDate = setFilterDate("browser")
  const clientInfo = loadClient(context)
  for(i=0;i<clientInfo.length;i++){
    let currentClient;
    if(staging.on === true){
      currentClient = clientInfo[staging.number]
    } else{
      currentClient = clientInfo[i]
    }
    let clientUrl,apiKey,apiSecret;
    if(staging.on === true){
      clientUrl = currentClient.client_staging
      apiKey = currentClient.staging_api_key
      apiSecret = currentClient.staging_api_secret
    } else{
      clientUrl = currentClient.client_prod
      apiKey = currentClient.prod_api_key
      apiSecret = currentClient.prod_api_secret

    }
    if(currentClient.active === true){
      let WooCommerce = new WooCommerceAPI({
        url: clientUrl,
        consumerKey: apiKey,
        consumerSecret: apiSecret,
        wpAPI: true,
        version: 'wc/v2'
      });
      let termId = currentClient.attribute_term_id
      makeBatch(WooCommerce,filterDate,termId,currentClient,context)
      if(staging.on === true){
        break
      }
    }
  }
  context.done()
}




function loadClient(context){
  try {
    return YAML.load('D:\\home\\site\\wwwroot\\woo-integration\\clients.yml');
  } catch (e) {
    context.log(e)
  }
}

function makeBatch(WooCommerce,filterDate,termId,currentClient,context){
  let products;
  WooCommerce.get(`products?attribute=pa_manufacturer&attribute_term=${termId}&per_page=100`, function(err, data, res) {
    products = JSON.parse(data.body)
    context.log("Full Gear Products: "+products.length)
    WooCommerce.get(`orders?after=${filterDate}&per_page=100`, function(err, data, res) {
      if(err){
        context.log(err)
        return
      }
      let clientOrders = JSON.parse(data.body)
      context.log("Client Orders: "+clientOrders.length)
      if(clientOrders.length < 1){
        context.log(`There are no new Client Orders by ${currentClient.client_name} between ${setFilterDate()} and ${moment().format("YYYY-MM-DDTHH:mm:ss")}`)
        return
      }
      let fgOrders = findFullGearOrders(clientOrders,products)
      if(fgOrders.length < 1){
        context.log(`There are no new Full Gear Orders by ${currentClient.client_name} between ${setFilterDate()} and ${moment().format("YYYY-MM-DDTHH:mm:ss")}`)
        return
      }
      context.log("Full Gear Orders: "+fgOrders)
      let batchOrders = []
      for(let order of clientOrders){
        for(let check of fgOrders){
          if(order.id === check){
            batchOrders.push(order)
          }
        }
      }
      context.log("Orders to Batch: "+batchOrders.length)
      let cronosBatch = new CronosBatch(batchOrders,products,currentClient,context)
      context.log(JSON.stringify(cronosBatch.data))
      fetch(cronosEndPoint, {
        method: 'POST',
        body: JSON.stringify(cronosBatch.data),
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': "2e04b1f07cb0247e",
          'X-Secret-Key': "jn-G-2kbsH4AbcI8ZzDC2w"
        }
      }).then((response) => {
        context.log("STATUS: "+JSON.stringify(response.status))
        //context.done()
      }).catch((error) => {
        //context.log('--catch--')
        context.log(error)
        //context.done()
      })

      if(err){
        context.log(err)
      }
    })
    if(err){
      context.log(err)
    }
  })

}

function findFullGearOrders(clientOrders,products){
  let fgOrders = []
  for (let order of clientOrders) {
    let breaker = false
    for (let item of order.line_items){
      let productID = item.product_id
      let suspectProduct;
      for (let product of products){
        if (product.id === productID){
          suspectProduct = product
          for (let attribute of suspectProduct.attributes){
            if(attribute.options[0] === "Full Gear"){
              fgOrders.push(order.id)
              breaker = true
              break;
            }
          }
        }
      }
      if(breaker === true){
        break
      }
    }
  }
  return fgOrders
}
