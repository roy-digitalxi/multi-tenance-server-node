const mongoose = require("mongoose");

const mongo_host = (process.env.MONGO_SERVICE_HOST || 'localhost');
const mongo_port = (process.env.MONGO_SERVICE_PORT || 27017);

// MongoDB setup
let LanguageLabelSchema = new mongoose.Schema({
  Type: { type: String, trim: true, default: "" },
  Content: { type: String, trim: true, default: "" },
});
const languageLabel = mongoose.model("LanguageLabelSchema", LanguageLabelSchema);


// const url = 'mongodb://root:root@' + mongo_host + ':' + mongo_port + '/employee';
// const url = 'mongodb://localhost:27017/employee1';
// const url = 'mongodb://employee1:123456@localhost:27017/employee1';
// const url = 'mongodb://employee2:123456@localhost:27017/employee2';


app.get('/mongo_list', (req, res) => {

  mongoose.connect(
    url,
    (err, response) => {
      if (err) {
        console.log("MongoDB: failed:" + err);
      } else {

        languageLabel.find({}, (err, docs) => {
          if (err) {
            return res.json({
              confirmation: 'fail',
              err
            })
          }
          return res.json({
            confirmation: 'success',
            docs
          })
        });
      }
    }
  );
});

app.get('/mongo_create', (req, res) => {

  mongoose.connect(
    url,
    async (err, response) => {
      if (err) {
        console.log("MongoDB: failed:" + err);
      } else {

        const doc = {
          Type: 'Test',
          Content: 'Test Content'
        };
        try {
          const response = await languageLabel.create(doc);
          if (response) {
            return res.json({
              confirmation: 'success',
              doc: response
            })
          }
        } catch (err) {
          return res.json({
            confirmation: 'fail',
            err
          })
        }
      }
    }
  );
});