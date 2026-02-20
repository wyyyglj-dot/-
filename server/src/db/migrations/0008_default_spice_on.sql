-- 将所有现有菜品默认开启辣度选择
UPDATE menu_dish SET has_spice_option = 1 WHERE has_spice_option = 0;
