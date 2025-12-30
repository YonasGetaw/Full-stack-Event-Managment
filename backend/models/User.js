const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const bcrypt = require('bcrypt');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  // In User.js model, add this field to the model definition:
profileImage: {
  type: DataTypes.STRING,
  allowNull: true,
},
  firstName: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [2, 50],
    },
  },
  lastName: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [2, 50],
    },
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true,
      notEmpty: true,
    },
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      notEmpty: true,
    },
  },
  passwordHash: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  address: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  city: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  dob: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  role: {
    type: DataTypes.ENUM('user', 'admin'),
    defaultValue: 'user',
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive', 'pending', 'suspended'),
    defaultValue: 'pending',
  },
  emailVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  verificationTokenHash: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  verificationTokenExpires: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  resetPasswordTokenHash: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  resetPasswordExpires: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  refreshTokenHash: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  twoFactorEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  twoFactorOtpHash: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  twoFactorOtpExpires: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  loginAttempts: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  lockUntil: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'users',
  timestamps: true,
  hooks: {
    beforeCreate: async (user) => {
      if (user.changed('passwordHash')) {
        user.passwordHash = await bcrypt.hash(user.passwordHash, 12);
      }
    },
    beforeUpdate: async (user) => {
      if (user.changed('passwordHash')) {
        user.passwordHash = await bcrypt.hash(user.passwordHash, 12);
      }
    },
  },
});

User.prototype.isLocked = function() {
  const lockUntilMs = this.lockUntil ? new Date(this.lockUntil).getTime() : 0;
  return !!(lockUntilMs && lockUntilMs > Date.now());
};

User.prototype.incLoginAttempts = async function() {
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return await this.update({
      loginAttempts: 1,
      lockUntil: null,
    });
  }
  
  const attempts = this.loginAttempts + 1;
  let lockUntil = null;
  
  if (attempts >= 5) {
    lockUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes lock
  }
  
  return await this.update({
    loginAttempts: attempts,
    lockUntil,
  });
};

User.prototype.comparePassword = async function(candidatePassword) {
  if (this.isLocked()) {
    throw new Error('Account is temporarily locked due to multiple failed login attempts');
  }
  
  const isMatch = await bcrypt.compare(candidatePassword, this.passwordHash);
  
  if (!isMatch) {
    await this.incLoginAttempts();
    return false;
  }
  
  if (this.loginAttempts > 0 || this.lockUntil) {
    await this.update({
      loginAttempts: 0,
      lockUntil: null,
    });
  }
  
  return true;
};

module.exports = User;