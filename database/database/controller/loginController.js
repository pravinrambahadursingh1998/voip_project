const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const User = require("../models/user_modal");

const login = async (req, res) => {
  try {
    console.log('req.body', req.body);
    
    const { email, password } = req.body.data;

    const user = await User.where({ email: req.body.data.email }).fetch({ require: false });
    console.log('user', user);

    if (!user) {
      return res.json({
        success: false,
        message: "Invalid Email."
      });
    }

    // const isMatch = await bcrypt.compare(password, user.get("password"));

    // if (!isMatch) {
    //   return res.json({
    //     success: false,
    //     message: "Invalid Password."
    //   });
    // }
    if (password !== user.attributes.password) {
      return res.json({
        success: false, 
        message: "Invalid Password."
      });
    }

    const token = jwt.sign(
      {
        id: user.attributes.id,
        company_id: user.attributes.company_id,
        role_id: user.attributes.role_id,
        first_name: user.attributes.first_name,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    return res.json({
      success: true,
      message: "Login Successfully.",
      token,
      data: {
        id: user.attributes.id,
        username: user.attributes.username,
        email: user.attributes.email,
        first_name: user.attributes.first_name,
        last_name: user.attributes.last_name,
        company_id: user.attributes.company_id
      }
    });

  } catch (error) {
    console.log('error', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
    login
}