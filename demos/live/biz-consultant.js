const faker = require("faker")

const spewIt = () => {
  console.log(faker.company.catchPhrase())
}
spewIt()
setInterval(spewIt, 3000)
