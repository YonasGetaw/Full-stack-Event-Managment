const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const GalleryReaction = sequelize.define(
  'GalleryReaction',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    galleryId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    reaction: {
      type: DataTypes.ENUM('like', 'dislike'),
      allowNull: false,
    },
  },
  {
    tableName: 'gallery_reactions',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['galleryId', 'userId'],
      },
    ],
  }
);

module.exports = GalleryReaction;
