var express = require('express')
var bodyParser = require('body-parser');
var app = express()

var port = 3000

app.use(bodyParser.json()); // for parsing application/json

app.listen(port)

/*
  decided to keep unordered list. Reasoning is as follows :
  we are likely gonna push values more than we are gonna request statistics.
  thus, we want pushes to be "faster".
  - ordered lists have O(n) pushes, but O(1) statistics.
  - unordered lists have O(1) pushes, but O(n) statistics.
*/

var db = {}
var lastID = 0

app.get('/', function (req, res) {
  res.send('<h1>Welcome to Metric.js</h1>')
})

/*

      ~ GET (/api/metrics) : Retrieve all metrics

      ~ No input expected

      ~ JSON output
        - "status" : http result status code (int)
        - "metrics" : collection of all metrics (dictionary)

*/

app.get('/api/metrics', function (req, res, next) {
  res.status(200).json(db)
  return next()
})

/*

      ~ POST (/api/metrics) : Creates new metrics

      ~ Expected JSON input
        - name (string)
        - (optional) values ([numbers])

      ~ JSON output
        - "status" : http result status code (int)
        - "id"     : id of newly created metric (string)

 */

app.post('/api/metrics', function (req, res, next) {
  if (!("name" in req.body)) {
    res.status(400).json({"status": 400 , "message" : "Bad request ; missing \"name\""});
    return next()
  }

  var req = req.body

  var name = req["name"]
  var values = []
  var max = null
  var min = null
  var sum = null
  var med = null
  var isValid = false

  if ("values" in req) {
    values = req["values"]

    if (values.constructor !== Array) {
      res.status(400).json({"status": 400 , "message" : "Bad request ; values should be of type Array"});
      return next()
    }

    if (values.some(isNaN)) {
      res.status(400).json({"status": 400 , "message" : "Bad request ; values should all be numeric"});
      return next()
    }

    max = values[0]
    min = values[0]
    sum = 0
    med = values[0]

    for (var i = 0; i < values.length; i++) {
      sum += values[i]
      if (max < values[i]) max = values[i]
      if (min > values[i]) min = values[i]
    }
  }

  var metric = {
    'name'    : name,       // name of metric
    'values'  : values,     // list of values
    'max'     : max,        // max metric value
    'min'     : min,        // min metric value
    'sum'     : sum,        // sum of values (for avg computation)
    'med'     : {
      'val' : med,          // median metric value
      'isValid' : isValid   // is median valid?
    }
  }

  var id = lastID.toString()
  db[id] = metric

  lastID += 1

  res.status(200).json({ "status": 200 , "id" : id});
  return next()
})

function idParamIsValid(id) {
  if (isNaN(id)) {
    return false
  } else { // know its a number, but is it an int?
    if (id % 1 !== 0) { // does it have remainder?
      return false
    }
  } return true
}


function calculateMedian(values) {
  if (values.length === 0) {
    return null
  }

  var median = null
  var midpoint = values.length/2
  values = values.sort()

  if (values.length % 2 === 0) {
    median = (values[midpoint] + values[midpoint-1])/2
  } else {
    midpoint = Math.floor(midpoint)
    median = values[midpoint]
  }

  return median
}

/*

      ~ GET (/api/metrics/:id) : gets summary statistics for
                                 metric with id == :id

      ~ No input expected

      ~ JSON output
        - status : http result status code (int)
        - summary_statistics : dictionary containing min,
                               max, median, and mean

*/

app.get('/api/metrics/:id', function (req, res, next) {
  var id = req.params.id

  if (!idParamIsValid(id)) {
    res.status(400).json({"status" : 400, "message" : "Bad Request ; id should be int"})
    return next()
  }

  id = id.toString()

  if (!(id in db)) {
    res.status(400).json({"status" : 400, "message" : "Bad Request ; id not in db"})
    return next()
  }

  var metric = db[id]

  if (metric.values.length === 0) {
    res.status(400).json({"status" : 400, "message" : "Metric is empty ; Insert some values first."})
    return next()
  }

  var min = metric.min
  var max = metric.max
  var med = metric.med.val
  var mean = metric.sum/metric.values.length

  if (!metric.med.isValid) {
    med = calculateMedian(metric.values)
    db[id].med.isValid = true
  }

  var resObj = {
    "status": 200,
    "summary_statistics" :
    {
      "min" : min,
      "max" : max,
      "med" : med,
      "mean" : mean
    }
  }

  res.status(200).json(resObj)
  return next()
})

/*

      ~ POST (/api/metrics/:id) : post value to metric with id == :id

      ~ Expected JSON input
        - value (number)

      ~ JSON output
        - "status" : http result status code (int)
          - 400 : push failed (read message for details)
          - 200 : push successful

*/

app.post('/api/metrics/:id', function (req, res, next) {

  if (!("value" in req.body)) {
    res.status(400).json({"status": 400 , "message" : "Bad request ; missing \"value\""});
    return next()
  }

  var val = req.body.value
  var id = req.params.id

  if (!idParamIsValid(id)) {
    res.status(400).json({"status" : 400, "message" : "Bad Request ; id should be int."})
    return next()
  }

  if (!(id in db)) {
    res.status(400).json({"status" : 400, "message" : "Bad Request ; id not in db"})
    return next()
  }

  var metric = db[id]

  metric.values.push(val)

  metric.sum += val

  if (metric.min === null) { // first val being added, so min is null
    metric.min = val
  } else {
    if (metric.min > val) {
      metric.min = val
    }
  }

  if (metric.max === null) { // first val being added, so max is null
    metric.max = val
  } else {
    if (metric.max < val) {
      metric.max = val
    }
  }

  if (metric.med.isValid) { // median is no longer valid
    metric.med.isValid = false
  }

  db[id] = metric

  var resObj = {"status": 200}

  res.status(200).json(resObj)
  return next()
})
