const WooCommerceAPI = require('woocommerce-api')
const fetch = require('node-fetch')
const CronosBatch = require('./cronos-batch')
const YAML = require('yamljs')
const fs = require('fs')
const moment = require('moment')
const cronosEndPoint = "https://portal.fullgear.com/api/v1/orders/"
const staging={};
staging.on = true
staging.number = 0

azureFunction()
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
function azureFunction(){
  // module.exports = function(console,myTimer){
  console.log(staging)
  const filterDate = setFilterDate("browser")
  const clientInfo = loadClient()
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
      let promises = [];
      wooGet(0,promises,WooCommerce,termId).then((response) => {
        console.log(response)
      })
      // makeBatch(WooCommerce,filterDate,termId,currentClient)
      if(staging.on === true){
        break
      }
    }
  }
  // console.done()
}




function loadClient(){
  try {
    return YAML.load('clients.yml');
  } catch (e) {
    console.log(e)
  }
}
function getProducts(WooCommerce,termId){
  return new Promise((resolve,reject) =>{
    let productPages = []
    let breaker = false
    for (i = 1;breaker === false; i++) {
      let productPage = WooCommerce.getAsync(`products?attribute=pa_manufacturer&attribute_term=${termId}&per_page=100&page=${i}`).then((response) => {
        if(response.body.length > 0){
          return JSON.parse(response.body)
        }else{
          breaker =true
          let products = []
          for(ii=0;ii<productPages.length;ii++){
            products = products.concat(productPages[ii])
          }
          resolve(product)
        }
      }).catch((error) => {
        reject(error)
      })
    }
  })
}
function wooGet(a,promises,WooCommerce,termId){
  return new Promise((resolve,reject) => {
    a++
    WooCommerce.getAsync(`products?attribute=pa_manufacturer&attribute_term=${termId}&per_page=100&page=${a}`).then((response) => {
      products = JSON.parse(response.body)
      if(products.length <1){
        resolve(promises)
      }else{
        promises.push(products)
        wooGet(a,promises,WooCommerce,termId).then((response) => {
          resolve(response)
        })
      }
    })
  })
}

function makeBatch(WooCommerce,filterDate,termId,currentClient){
  let productPage;
  for (i = 1;; i++) {
    WooCommerce.get(`products?attribute=pa_manufacturer&attribute_term=${termId}&per_page=100&page=${1}`, function(err, data, res) {
      productPage = JSON.parse(data.body)
      console.log(productPage)
      // if(productPage.length > 0){
      //   productPages.push(productPage)
      // }
      // if(err){
      //   console.log(err)
      // }
    })
  //   if(productPages[(i-1)].length < 1){
  //     break
    // }
  }
  // let products = []
  // for(i=0;i<productPages.length;i++){
  //   products = products.concat(productPages[i])
  // }
  // WooCommerce.get(`orders?after=${filterDate}&per_page=100`, function(err, data, res) {
  //   if(err){
  //     console.log(err)
  //     return
  //   }
  //   let clientOrders = JSON.parse(data.body)
  //   console.log("Client Orders: "+clientOrders.length)
  //   if(clientOrders.length < 1){
  //     console.log(`There are no new Client Orders by ${currentClient.client_name} between ${setFilterDate()} and ${moment().format("YYYY-MM-DDTHH:mm:ss")}`)
  //     return
  //   }
  //   let fgOrders = findFullGearOrders(clientOrders,products)
  //   if(fgOrders.length < 1){
  //     console.log(`There are no new Full Gear Orders by ${currentClient.client_name} between ${setFilterDate()} and ${moment().format("YYYY-MM-DDTHH:mm:ss")}`)
  //     return
  //   }
  //   console.log("Full Gear Orders: "+fgOrders)
  //   let batchOrders = []
  //   for(let order of clientOrders){
  //     for(let check of fgOrders){
  //       if(order.id === check){
  //         batchOrders.push(order)
  //       }
  //     }
  //   }
  //   console.log("Orders to Batch: "+batchOrders.length)
  //   let cronosBatch = new CronosBatch(batchOrders,products,currentClient,console)
  //   console.log(JSON.stringify(cronosBatch.data))
  //   fetch(cronosEndPoint, {
  //     method: 'POST',
  //     body: JSON.stringify(cronosBatch.data),
  //     headers: {
  //       'Content-Type': 'application/json',
  //       'X-Api-Key': "2e04b1f07cb0247e",
  //       'X-Secret-Key': "jn-G-2kbsH4AbcI8ZzDC2w"
  //     }
  //   }).then((response) => {
  //     console.log("STATUS: "+JSON.stringify(response.status))
  //     //console.done()
  //   }).catch((error) => {
  //     //console.log('--catch--')
  //     console.log(error)
  //     //console.done()
  //   })
  //
  //   if(err){
  //     console.log(err)
  //   }
  // })

  // console.log("Full Gear Products: "+products.length)


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
