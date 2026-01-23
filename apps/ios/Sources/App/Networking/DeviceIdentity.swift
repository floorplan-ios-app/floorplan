import Foundation
import Security

struct DeviceIdentity {
  let userId: String
  let actorId: String

  static func load() -> DeviceIdentity {
    let userId = KeychainStore.getOrCreate(key: "fp.user.id")
    let actorId = KeychainStore.getOrCreate(key: "fp.actor.id")
    return DeviceIdentity(userId: userId, actorId: actorId)
  }
}

private enum KeychainStore {
  static func getOrCreate(key: String) -> String {
    if let value = read(key: key) {
      return value
    }
    let value = UUID().uuidString.lowercased()
    store(key: key, value: value)
    return value
  }

  private static func read(key: String) -> String? {
    let query: [CFString: Any] = [
      kSecClass: kSecClassGenericPassword,
      kSecAttrService: "floorplan.identity",
      kSecAttrAccount: key,
      kSecReturnData: true,
      kSecMatchLimit: kSecMatchLimitOne,
    ]
    var item: CFTypeRef?
    let status = SecItemCopyMatching(query as CFDictionary, &item)
    guard status == errSecSuccess, let data = item as? Data else {
      return nil
    }
    return String(data: data, encoding: .utf8)
  }

  private static func store(key: String, value: String) {
    let data = Data(value.utf8)
    let query: [CFString: Any] = [
      kSecClass: kSecClassGenericPassword,
      kSecAttrService: "floorplan.identity",
      kSecAttrAccount: key,
    ]
    let attributes: [CFString: Any] = [
      kSecValueData: data,
    ]

    let status = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
    if status == errSecItemNotFound {
      var addQuery = query
      addQuery[kSecValueData] = data
      _ = SecItemAdd(addQuery as CFDictionary, nil)
    }
  }
}
