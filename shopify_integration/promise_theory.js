// Thenables... what the fuck

function foo(){
  return new Promise((resolve,reject) => {
    resolve("foo")
  })
}

function bar(){
  return new Promise((resolve,reject) => {
    resolve("bar")
  })
}

function foobar(){
  return Promise.all([foo(),bar()])
  }

foobar().then((foobar) => {
  Promise.all(foobar).then((response) => {
    console.log(response[0]+response[1])
  })
})
