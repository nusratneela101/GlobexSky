/**
 * backend/models/index.js
 *
 * Single entry point for all model exports.
 * Usage:
 *   import { User, Product, Order } from '../models/index.js';
 *   // or
 *   import models from '../models/index.js';
 *   const { User, Product } = models;
 */

export { default as BaseModel } from './BaseModel.js';
export { default as User } from './User.js';
export { default as Product } from './Product.js';
export { default as Order } from './Order.js';
export { default as Supplier } from './Supplier.js';
export { default as Category } from './Category.js';
export { default as Commission } from './Commission.js';
export { default as SubscriptionPlan } from './SubscriptionPlan.js';
export { default as Inspection } from './Inspection.js';
export { default as RFQ } from './RFQ.js';
export { default as Quotation } from './Quotation.js';
export { default as Wishlist } from './Wishlist.js';
export { default as Notification } from './Notification.js';
export { default as BlogPost } from './BlogPost.js';
export { default as CarrierProduct } from './CarrierProduct.js';
export { default as FeatureToggle } from './FeatureToggle.js';
export { default as TradeShow } from './TradeShow.js';
export { default as Message } from './Message.js';
export { default as Conversation } from './Conversation.js';
export { default as EmailTemplate } from './EmailTemplate.js';
export { default as SmsTemplate } from './SmsTemplate.js';
export { default as GDPRRequest } from './GDPRRequest.js';
export { default as VRShowroom } from './VRShowroom.js';
export { default as Meeting } from './Meeting.js';
export { default as Warehouse } from './Warehouse.js';
export { default as SavedSearch } from './SavedSearch.js';
export { default as SearchHistory } from './SearchHistory.js';
export { default as SystemConfig } from './SystemConfig.js';
export { default as ProductComparison } from './ProductComparison.js';
export {
  TradeAssurancePolicy,
  TradeAssuranceClaim,
  TradeAssuranceDeposit,
  TradeAssuranceConfig,
} from './TradeAssurance.js';


import BaseModel from './BaseModel.js';
import User from './User.js';
import Product from './Product.js';
import Order from './Order.js';
import Supplier from './Supplier.js';
import Category from './Category.js';
import Commission from './Commission.js';
import SubscriptionPlan from './SubscriptionPlan.js';
import Inspection from './Inspection.js';
import RFQ from './RFQ.js';
import Quotation from './Quotation.js';
import Wishlist from './Wishlist.js';
import Notification from './Notification.js';
import BlogPost from './BlogPost.js';
import CarrierProduct from './CarrierProduct.js';
import FeatureToggle from './FeatureToggle.js';
import TradeShow from './TradeShow.js';
import Message from './Message.js';
import Conversation from './Conversation.js';
import EmailTemplate from './EmailTemplate.js';
import SmsTemplate from './SmsTemplate.js';
import GDPRRequest from './GDPRRequest.js';
import VRShowroom from './VRShowroom.js';
import Meeting from './Meeting.js';
import Warehouse from './Warehouse.js';
import SavedSearch from './SavedSearch.js';
import SearchHistory from './SearchHistory.js';
import SystemConfig from './SystemConfig.js';
import ProductComparison from './ProductComparison.js';
import {
  TradeAssurancePolicy,
  TradeAssuranceClaim,
  TradeAssuranceDeposit,
  TradeAssuranceConfig,
} from './TradeAssurance.js';

export default {
  BaseModel,
  User,
  Product,
  Order,
  Supplier,
  Category,
  Commission,
  SubscriptionPlan,
  Inspection,
  RFQ,
  Quotation,
  Wishlist,
  Notification,
  BlogPost,
  CarrierProduct,
  FeatureToggle,
  TradeShow,
  Message,
  Conversation,
  EmailTemplate,
  SmsTemplate,
  GDPRRequest,
  VRShowroom,
  Meeting,
  Warehouse,
  SavedSearch,
  SearchHistory,
  SystemConfig,
  ProductComparison,
  TradeAssurancePolicy,
  TradeAssuranceClaim,
  TradeAssuranceDeposit,
  TradeAssuranceConfig,
};
